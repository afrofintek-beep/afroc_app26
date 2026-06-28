import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, ArrowLeft, Mail, Phone, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { usePhoneValidation } from "@/hooks/usePhoneValidation";
import afrolocSymbol from "@/assets/afroloc-symbol-brand.webp";

export default function Signup() {
  const { user } = useAuth();
  const [signupMethod, setSignupMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [fullName, setFullName] = useState("");

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (value.length === 0) {
      setEmailValid(null);
    } else {
      setEmailValid(validateEmail(value));
    }
  };
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneOperator, setPhoneOperator] = useState<{name: string, code: string, country: string} | null>(null);
  const [phoneValidationError, setPhoneValidationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { validatePhone, validating } = usePhoneValidation();

  // Password validation requirements - must be after t is defined
  const validatePasswordStrength = (pwd: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (pwd.length < 8) {
      errors.push(t('password_min_8_chars') || 'Mínimo 8 caracteres');
    }
    if (!/[A-Z]/.test(pwd)) {
      errors.push(t('password_requires_uppercase') || 'Pelo menos uma letra maiúscula');
    }
    if (!/\d/.test(pwd)) {
      errors.push(t('password_requires_number') || 'Pelo menos um número');
    }
    if (!/[^a-zA-Z0-9]/.test(pwd)) {
      errors.push(t('password_requires_symbol') || 'Pelo menos um símbolo');
    }
    
    return { isValid: errors.length === 0, errors };
  };

  const getPasswordStrength = (pwd: string): { level: number; label: string; color: string } => {
    if (!pwd) return { level: 0, label: '', color: '' };
    
    const { errors } = validatePasswordStrength(pwd);
    
    // Calculate score based on requirements met
    const requirementsMet = 4 - errors.length;
    
    if (requirementsMet <= 1) return { level: 1, label: t('password_weak'), color: 'bg-destructive' };
    if (requirementsMet <= 2) return { level: 2, label: t('password_medium'), color: 'bg-yellow-500' };
    if (requirementsMet === 3) return { level: 2, label: t('password_medium'), color: 'bg-yellow-500' };
    return { level: 3, label: t('password_strong'), color: 'bg-chart-2' };
  };

  const passwordValidation = validatePasswordStrength(password);
  const passwordStrength = getPasswordStrength(password);

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    } else {
      checkPreSignupData();
    }
  }, [user, navigate]);

  const checkPreSignupData = () => {
    // Check if pre-signup data was passed via router state
    if (!location.state) {
      // Redirect back to pre-signup if no state data
      navigate("/pre-signup");
    }
  };

  const handlePhoneChange = async (value: string) => {
    // Auto-format: ensure phone starts with +
    let formattedPhone = value.trim();
    
    // Remove any non-digit characters except the first +
    formattedPhone = formattedPhone.replace(/[^\d+]/g, '');
    
    // Remove all + signs first, then add one at the beginning
    formattedPhone = formattedPhone.replace(/\+/g, '');
    
    // If we have any digits, add + at the start
    if (formattedPhone.length > 0) {
      formattedPhone = '+' + formattedPhone;
    }
    
    setPhone(formattedPhone);
    setPhoneValidationError(null);
    setPhoneOperator(null);

    // Only validate when phone has minimum complete length (country code + number)
    // Example: +244 (Angola) + 9 digits = 13 chars minimum
    if (formattedPhone.length >= 13) {
      const result = await validatePhone(formattedPhone);
      if (result.isValid && result.operator) {
        setPhoneOperator(result.operator);
      } else {
        setPhoneValidationError(result.error);
      }
    }
  };

  const handleSendOTP = async () => {
    // Validate phone format before sending
    if (!phone || phone.length < 10) {
      toast({
        title: t('error'),
        description: t('invalid_phone_number'),
        variant: "destructive",
      });
      return;
    }
    
    if (!phone.startsWith('+')) {
      toast({
        title: t('error'),
        description: t('phone_must_start_with_plus'),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // STEP 1: Check if phone already exists (conflict detection)
      const { data: existingUser } = await supabase
        .rpc('get_user_by_phone', { p_phone: phone });

      if (existingUser && existingUser.length > 0) {
        const user = existingUser[0];
        toast({
          title: t('phone_already_registered'),
          description: t('phone_already_registered_desc'),
          variant: "destructive",
        });
        
        // Show login option
        setTimeout(() => {
          toast({
            title: t('account_exists'),
            description: t('use_login_instead'),
            action: (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/login')}
              >
                {t('go_to_login')}
              </Button>
            ),
          });
        }, 2000);
        
        setLoading(false);
        return;
      }

      // STEP 2: Phone is available - send OTP
      const { data, error } = await supabase.functions.invoke('send-signup-otp', {
        body: { phone }
      });

      if (error) throw error;

      setOtpSent(true);
      if (data?.operator) {
        setPhoneOperator(data.operator);
        toast({
          title: t('phone_operator_detected'),
          description: `${data.operator.name} (${data.operator.country})`,
        });
      }
      toast({
        title: t('otp_sent'),
        description: t('otp_sent_desc'),
      });
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message || t('invalid_phone_operator'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast({
        title: t('error'),
        description: t('enter_6_digit_code'),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-signup-otp', {
        body: { phone, otp_code: otp }
      });

      if (error) {
        // Handle max attempts reached
        if (error.message?.includes('max_attempts_reached') || error.message?.includes('Máximo de tentativas')) {
          toast({
            title: t('error'),
            description: error.message || t('max_attempts_exceeded'),
            variant: "destructive",
          });
          // Reset OTP state to allow user to request new code
          setOtpSent(false);
          setOtp("");
          return;
        }
        
        // Handle remaining attempts
        const remainingMatch = error.message?.match(/(\d+)\s+tentativa/);
        if (remainingMatch) {
          const remaining = remainingMatch[1];
          toast({
            title: t('error'),
            description: error.message,
            variant: "destructive",
          });
          return;
        }
        
        throw error;
      }

      setPhoneVerified(true);
      toast({
        title: t('success'),
        description: t('phone_verified'),
      });
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message || t('error_verifying_otp'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // CRITICAL: Require phone verification for ALL signups (both email and phone)
    if (!phoneVerified) {
      toast({
        title: t('error'),
        description: t('verify_phone_first'),
        variant: "destructive",
      });
      return;
    }
    
    // Additional validation for email signup
    if (signupMethod === "email") {
      if (!email || !password) {
        toast({
          title: t('error'),
          description: t('invalid_credentials'),
          variant: "destructive",
        });
        return;
      }
      
      // MANDATORY: Strong password validation
      const { isValid, errors } = validatePasswordStrength(password);
      if (!isValid) {
        toast({
          title: t('password_too_weak') || 'Senha muito fraca',
          description: errors.join(', '),
          variant: "destructive",
        });
        return;
      }
      
      // Check if passwords match
      if (password !== confirmPassword) {
        toast({
          title: t('error'),
          description: t('passwords_do_not_match'),
          variant: "destructive",
        });
        return;
      }
    }
    
    setLoading(true);

    try {
      // Get pre-signup data from router state
      const preSignupData = location.state;
      if (!preSignupData) {
        throw new Error("Missing pre-signup data");
      }

      // Use server-side validation edge function for secure signup
      const { data, error } = await supabase.functions.invoke('validate-signup', {
        body: {
          email: signupMethod === "email" ? email : undefined,
          password: signupMethod === "email" ? password : undefined,
          phone,
          fullName,
          country: preSignupData.country,
          city: preSignupData.city,
          purposes: preSignupData.purposes,
          signupMethod,
        }
      });

      // Handle edge function error - check data first as it may contain the error details
      if (error || !data?.success) {
        // Handle specific error codes from server
        const errorCode = data?.code;
        let errorMessage = data?.error || error?.message || 'Erro ao criar conta';
        
        if (errorCode === 'WEAK_PASSWORD') {
          errorMessage = t('password_too_weak') + ': ' + (data.passwordErrors?.join(', ') || '');
        } else if (errorCode === 'PHONE_EXISTS') {
          errorMessage = t('phone_already_registered');
        } else if (errorCode === 'EMAIL_EXISTS' || errorCode === 'AUTH_ERROR') {
          // AUTH_ERROR often means email already exists
          if (data?.error?.includes('email') && data?.error?.includes('registered')) {
            errorMessage = t('email_already_registered') || 'Este email já está registado';
          } else {
            errorMessage = data?.error || t('email_already_registered') || 'Este email já está registado';
          }
        } else if (errorCode === 'PHONE_NOT_VERIFIED') {
          errorMessage = t('verify_phone_first');
        } else if (errorCode === 'RATE_LIMITED') {
          errorMessage = t('too_many_attempts') || 'Muitas tentativas. Tente novamente mais tarde.';
        }
        
        toast({
          title: t('error'),
          description: errorMessage,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Auto-login after successful signup
      if (signupMethod === "email") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (signInError) {
          console.error('Auto-login failed:', signInError);
          toast({
            title: t('success'),
            description: t('account_created') + '. ' + t('please_login'),
          });
          navigate("/login");
          return;
        }
      }

      toast({
        title: t('success'),
        description: t('account_created'),
      });
      navigate("/dashboard");
    } catch (error: any) {
      console.error('Signup error:', error);
      toast({
        title: t('error'),
        description: error.message || 'Erro ao criar conta',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 bg-gradient-mesh opacity-40 -z-10"></div>
      <div className="fixed -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10 animate-float"></div>
      <div className="fixed -bottom-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl -z-10 animate-float" style={{ animationDelay: '1s' }}></div>
      
      <div className="absolute top-4 left-4 animate-fade-in">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/pre-signup")}
          title={t('back')}
          className="glass hover:shadow-glow transition-all"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
      <div className="absolute top-4 right-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <LanguageSelector />
      </div>
      
      <Card className="w-full max-w-md glass-strong border border-border/50 shadow-premium animate-scale-in">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4 animate-float">
            <div className="flex flex-col items-center gap-2">
              <img src={afrolocSymbol} alt="AFROLOC" className="h-14 w-14 object-cover rounded-xl shadow-md ring-1 ring-primary/20" />
              <span className="text-lg font-display font-bold text-primary tracking-wide">AFROLOC</span>
            </div>
          </div>
          <CardTitle className="text-3xl font-display">{t('create_your_afroloc')}</CardTitle>
          <CardDescription className="text-base">{t('register_description')}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="space-y-4">
            <Tabs value={signupMethod} onValueChange={(v) => setSignupMethod(v as "email" | "phone")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="email">
                  <Mail className="mr-2 h-4 w-4" />
                  {t('use_email')}
                </TabsTrigger>
                <TabsTrigger value="phone">
                  <Phone className="mr-2 h-4 w-4" />
                  {t('use_phone')}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="email" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t('full_name')}</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder={t('full_name')}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                
                {/* REQUIRED: Phone verification for email signup */}
                <div className="space-y-2">
                  <Label htmlFor="phoneEmail" className="flex items-center gap-2">
                    {t('phone_number')}
                    <span className="text-xs text-destructive">*{t('required')}</span>
                  </Label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="phoneEmail"
                          type="tel"
                          placeholder="+244 900 000 000"
                          value={phone}
                          onChange={(e) => handlePhoneChange(e.target.value)}
                          required
                          disabled={otpSent}
                          className="pr-10"
                        />
                        {validating && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          </div>
                        )}
                        {!validating && phoneOperator && !otpSent && (
                          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-chart-2" />
                        )}
                        {!validating && phoneValidationError && !otpSent && (
                          <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                        )}
                      </div>
                      {!otpSent && (
                        <Button 
                          type="button" 
                          onClick={handleSendOTP}
                          disabled={loading || !phone || validating || !phoneOperator}
                        >
                          {t('send_otp')}
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('phone_verification_required') || 'Verificação de telefone obrigatória para todos os registos'}
                    </p>
                    {phoneOperator && !otpSent && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-chart-2" />
                        <span>{phoneOperator.name} ({phoneOperator.country})</span>
                      </div>
                    )}
                    {phoneValidationError && !otpSent && (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span>{phoneValidationError}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* OTP Verification for Email Signup */}
                {otpSent && !phoneVerified && (
                  <>
                    <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Phone className="h-4 w-4 text-primary" />
                        <span>{t('verify_phone_first')}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('otp_sent_desc')}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="otpEmail">{t('otp_code')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="otpEmail"
                          type="text"
                          placeholder={t('enter_otp')}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          maxLength={6}
                          className="flex-1"
                        />
                        <Button 
                          type="button" 
                          onClick={handleVerifyOTP}
                          disabled={loading || otp.length !== 6}
                        >
                          {t('verify_otp')}
                        </Button>
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setOtpSent(false);
                          setOtp("");
                        }}
                        className="w-full"
                      >
                        {t('resend_otp')}
                      </Button>
                    </div>
                  </>
                )}
                
                {phoneVerified && (
                  <div className="rounded-lg bg-chart-2/10 border border-chart-2/20 p-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-chart-2" />
                    <span className="text-sm font-medium text-chart-2">
                      {t('phone_verified')}
                    </span>
                  </div>
                )}
                
                {/* Email and Password - Only shown after phone verification */}
                {phoneVerified && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t('email')}</Label>
                      <div className="relative">
                        <Input
                          id="email"
                          type="email"
                          placeholder={t('email_placeholder')}
                          value={email}
                          onChange={(e) => handleEmailChange(e.target.value)}
                          required
                          className="pr-10"
                        />
                        {emailValid === true && (
                          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-chart-2" />
                        )}
                        {emailValid === false && (
                          <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                        )}
                      </div>
                      {emailValid === false && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {t('email_invalid')}
                        </p>
                      )}
                      {emailValid === true && (
                        <p className="text-xs text-chart-2 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {t('email_valid')}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">{t('password')}</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder={t('password_min_8_chars')}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={8}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {password && (
                        <div className="space-y-2">
                          <div className="flex gap-1">
                            {[1, 2, 3].map((level) => (
                              <div
                                key={level}
                                className={`h-1.5 flex-1 rounded-full transition-colors ${
                                  level <= passwordStrength.level ? passwordStrength.color : 'bg-muted'
                                }`}
                              />
                            ))}
                          </div>
                          <p className={`text-xs ${
                            passwordStrength.level === 1 ? 'text-destructive' : 
                            passwordStrength.level === 2 ? 'text-yellow-500' : 'text-chart-2'
                          }`}>
                            {passwordStrength.label}
                          </p>
                          {/* Password requirements checklist */}
                          <div className="text-xs space-y-1 mt-2">
                            <p className={password.length >= 8 ? 'text-chart-2' : 'text-muted-foreground'}>
                              {password.length >= 8 ? '✓' : '○'} {t('password_min_8_chars')}
                            </p>
                            <p className={/[A-Z]/.test(password) ? 'text-chart-2' : 'text-muted-foreground'}>
                              {/[A-Z]/.test(password) ? '✓' : '○'} {t('password_requires_uppercase')}
                            </p>
                            <p className={/\d/.test(password) ? 'text-chart-2' : 'text-muted-foreground'}>
                              {/\d/.test(password) ? '✓' : '○'} {t('password_requires_number')}
                            </p>
                            <p className={/[^a-zA-Z0-9]/.test(password) ? 'text-chart-2' : 'text-muted-foreground'}>
                              {/[^a-zA-Z0-9]/.test(password) ? '✓' : '○'} {t('password_requires_symbol')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">{t('confirm_password')}</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder={t('confirm_password_placeholder')}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          minLength={8}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {confirmPassword && password !== confirmPassword && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {t('passwords_do_not_match')}
                        </p>
                      )}
                      {confirmPassword && password === confirmPassword && passwordValidation.isValid && (
                        <p className="text-xs text-chart-2 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {t('passwords_match')}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="phone" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="fullNamePhone">{t('full_name')}</Label>
                  <Input
                    id="fullNamePhone"
                    type="text"
                    placeholder={t('full_name')}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">{t('phone_number')}</Label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="phoneNumber"
                          type="tel"
                          placeholder="+244912345678"
                          value={phone}
                          onChange={(e) => handlePhoneChange(e.target.value)}
                          required
                          disabled={otpSent}
                          className="pr-10"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('phone_format_hint') || 'Formato: +[código país][número] (ex: +244912345678)'}
                        </p>
                        {validating && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          </div>
                        )}
                        {!validating && phoneOperator && !otpSent && (
                          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
                        )}
                        {!validating && phoneValidationError && !otpSent && (
                          <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                        )}
                      </div>
                      {!otpSent && (
                        <Button 
                          type="button" 
                          onClick={handleSendOTP}
                          disabled={loading || !phone || validating || !phoneOperator}
                        >
                          {t('send_otp')}
                        </Button>
                      )}
                    </div>
                    {phoneOperator && !otpSent && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>{phoneOperator.name} ({phoneOperator.country})</span>
                      </div>
                    )}
                    {phoneValidationError && !otpSent && (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span>{phoneValidationError}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {otpSent && !phoneVerified && (
                  <>
                    {phoneOperator && (
                      <div className="rounded-lg bg-muted p-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-primary" />
                          <span className="font-medium">{t('phone_operator_detected')}:</span>
                          <span>{phoneOperator.name}</span>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="otp">{t('otp_code')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="otp"
                          type="text"
                          placeholder={t('enter_otp')}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          maxLength={6}
                          className="flex-1"
                        />
                        <Button 
                          type="button" 
                          onClick={handleVerifyOTP}
                          disabled={loading || otp.length !== 6}
                        >
                          {t('verify_otp')}
                        </Button>
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost"
                        size="sm"
                        onClick={handleSendOTP}
                        disabled={loading}
                        className="w-full"
                      >
                        {t('resend_otp')}
                      </Button>
                    </div>
                  </>
                )}
                
                {phoneVerified && (
                  <div className="rounded-lg bg-primary/10 p-3 text-sm text-primary">
                    ✓ {t('phone_verified')}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full bg-gradient-primary hover:scale-105 shadow-elegant hover:shadow-glow transition-all" 
              disabled={loading || (signupMethod === "phone" && !phoneVerified)}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {loading ? t('creating_account') : t('create_account')}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              {t('already_have_account')}{" "}
              <Link to="/login" className="text-primary hover:underline">
                {t('log_in')}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
