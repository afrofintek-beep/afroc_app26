import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/auth_rbac.ts";

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS_PER_IP = 10; // Max 10 signup attempts per IP per window
const MAX_ATTEMPTS_PER_PHONE = 5; // Max 5 attempts per phone number per window

// In-memory rate limit store (resets on function cold start)
// For production, consider using Redis or database-backed storage
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function getRateLimitKey(type: 'ip' | 'phone', value: string): string {
  return `${type}:${value}`;
}

function checkRateLimit(key: string, maxAttempts: number): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  // Clean up expired entries
  if (record && now > record.resetTime) {
    rateLimitStore.delete(key);
  }
  
  const currentRecord = rateLimitStore.get(key);
  
  if (!currentRecord) {
    // First request, create new record
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: maxAttempts - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }
  
  if (currentRecord.count >= maxAttempts) {
    const resetIn = currentRecord.resetTime - now;
    return { allowed: false, remaining: 0, resetIn };
  }
  
  // Increment counter
  currentRecord.count++;
  rateLimitStore.set(key, currentRecord);
  
  return { 
    allowed: true, 
    remaining: maxAttempts - currentRecord.count, 
    resetIn: currentRecord.resetTime - now 
  };
}

function getClientIP(req: Request): string {
  // Try various headers that might contain the real IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // Fallback to a hash of other identifying information
  return 'unknown';
}

interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];
  
  if (!password || password.length < 8) {
    errors.push('Mínimo 8 caracteres');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Pelo menos uma letra maiúscula');
  }
  if (!/\d/.test(password)) {
    errors.push('Pelo menos um número');
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Pelo menos um símbolo (!@#$%^&*)');
  }
  
  return { isValid: errors.length === 0, errors };
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = getClientIP(req);
  console.log(`Signup request from IP: ${clientIP}`);

  // Check IP rate limit first
  const ipKey = getRateLimitKey('ip', clientIP);
  const ipRateLimit = checkRateLimit(ipKey, MAX_ATTEMPTS_PER_IP);
  
  if (!ipRateLimit.allowed) {
    const retryAfterSeconds = Math.ceil(ipRateLimit.resetIn / 1000);
    console.log(`Rate limit exceeded for IP: ${clientIP}. Retry after ${retryAfterSeconds}s`);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Demasiadas tentativas. Por favor, aguarde ${Math.ceil(retryAfterSeconds / 60)} minutos antes de tentar novamente.`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: retryAfterSeconds
      }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': retryAfterSeconds.toString()
        } 
      }
    );
  }

  try {
    const { email, password, phone, fullName, country, city, purposes, signupMethod } = await req.json();
    
    console.log('Validating signup request for:', email || phone);

    // Validate required fields
    if (!phone) {
      console.log('Validation failed: Phone is required');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Número de telefone é obrigatório',
          code: 'PHONE_REQUIRED'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check phone-specific rate limit
    const phoneKey = getRateLimitKey('phone', phone);
    const phoneRateLimit = checkRateLimit(phoneKey, MAX_ATTEMPTS_PER_PHONE);
    
    if (!phoneRateLimit.allowed) {
      const retryAfterSeconds = Math.ceil(phoneRateLimit.resetIn / 1000);
      console.log(`Rate limit exceeded for phone: ${phone}. Retry after ${retryAfterSeconds}s`);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Demasiadas tentativas para este número. Por favor, aguarde ${Math.ceil(retryAfterSeconds / 60)} minutos.`,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: retryAfterSeconds
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': retryAfterSeconds.toString()
          } 
        }
      );
    }

    // For email signup, validate email and password
    if (signupMethod === 'email') {
      if (!email || !validateEmail(email)) {
        console.log('Validation failed: Invalid email format');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Formato de email inválido',
            code: 'INVALID_EMAIL'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // SERVER-SIDE PASSWORD VALIDATION - Critical security check
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        console.log('Validation failed: Password too weak -', passwordValidation.errors.join(', '));
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Senha muito fraca: ' + passwordValidation.errors.join(', '),
            code: 'WEAK_PASSWORD',
            passwordErrors: passwordValidation.errors
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if phone is already registered
    const { data: existingUser } = await supabase
      .rpc('get_user_by_phone', { p_phone: phone });

    if (existingUser && existingUser.length > 0) {
      console.log('Validation failed: Phone already registered');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Este número de telefone já está registado',
          code: 'PHONE_EXISTS'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if phone OTP was verified
    const { data: otpRecord } = await supabase
      .from('phone_otp_verifications')
      .select('*')
      .eq('phone_number', phone)
      .eq('verified', true)
      .order('verified_at', { ascending: false })
      .limit(1)
      .single();

    if (!otpRecord) {
      console.log('Validation failed: Phone not verified');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Número de telefone não verificado',
          code: 'PHONE_NOT_VERIFIED'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if OTP verification is recent (within 30 minutes)
    const verifiedAt = new Date(otpRecord.verified_at);
    const now = new Date();
    const minutesSinceVerification = (now.getTime() - verifiedAt.getTime()) / (1000 * 60);
    
    if (minutesSinceVerification > 30) {
      console.log('Validation failed: OTP verification expired');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Verificação de telefone expirada. Por favor, verifique novamente.',
          code: 'OTP_EXPIRED'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user based on signup method
    let signupEmail: string;
    let signupPassword: string;
    let userData: Record<string, any>;

    if (signupMethod === 'email') {
      signupEmail = email;
      signupPassword = password;
      userData = {
        full_name: fullName,
        phone: phone,
        country: country,
        city: city,
        purpose: purposes,
      };
    } else {
      // Phone-only signup
      signupEmail = phone.replace(/[^0-9]/g, '') + '@phone.afroid.local';
      signupPassword = crypto.randomUUID();
      userData = {
        full_name: fullName,
        phone: phone,
        country: country,
        city: city,
        purpose: purposes,
        is_phone_user: true,
      };
    }

    console.log('Creating user with email:', signupEmail);

    // Create the user using admin client
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: signupEmail,
      password: signupPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: userData,
    });

    if (authError) {
      console.error('Auth error creating user:', authError);
      
      // Handle specific errors
      if (authError.message?.includes('already registered') || authError.message?.includes('already exists')) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Este email já está registado',
            code: 'EMAIL_EXISTS'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: authError.message,
          code: 'AUTH_ERROR'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean up used OTP record
    await supabase
      .from('phone_otp_verifications')
      .delete()
      .eq('phone_number', phone);

    console.log('User created successfully:', authData.user?.id);

    // Return success with user data (but not sensitive info)
    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: authData.user?.id,
        message: 'Conta criada com sucesso'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in validate-signup function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
