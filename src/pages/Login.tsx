import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { LogIn, ArrowLeft, Mail, Phone, CheckCircle2, AlertCircle, Fingerprint, User, Briefcase, Shield, Smartphone } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { usePhoneValidation } from "@/hooks/usePhoneValidation";
import { useDeviceFingerprint } from "@/hooks/useDeviceFingerprint";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import afrolocSymbol from "@/assets/afroloc-symbol-brand.webp";

type UserType = 'citizen' | 'employee' | 'admin' | null;

export default function Login() {
  const { user } = useAuth();
  const [userType, setUserType] = useState<UserType>(null);
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneOperator, setPhoneOperator] = useState<{name: string, code: string, country: string} | null>(null);
  const [phoneValidationError, setPhoneValidationError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [trustedDevice, setTrustedDevice] = useState<{ deviceToken: string; userId: string; deviceName: string | null } | null>(null);
  const [checkingDevice, setCheckingDevice] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { validatePhone, validating } = usePhoneValidation();
  const deviceInfo = useDeviceFingerprint();
  const { 
    capabilities: biometricCapabilities, 
    isLoading: biometricLoading,
    saveCredentials: saveBiometricCredentials,
    authenticateWithBiometric,
    getBiometricLabel,
    logBiometricLogin 
  } = useBiometricAuth();

  // Redirecionar se já estiver autenticado
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // Check if phone has trusted device for quick login
  const checkTrustedDevice = async (phoneNumber: string) => {
    if (!deviceInfo?.fingerprint) return;
    
    setCheckingDevice(true);
    setTrustedDevice(null);
    
    try {
      const { data, error } = await supabase
        .from('biometric_devices')
        .select('device_token, user_id, device_name')
        .eq('phone_number', phoneNumber)
        .eq('device_fingerprint', deviceInfo.fingerprint)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      
      if (!error && data) {
        setTrustedDevice({ 
          deviceToken: data.device_token, 
          userId: data.user_id,
          deviceName: data.device_name 
        });
      }
    } catch (err) {
      console.error('Error checking trusted device:', err);
    } finally {
      setCheckingDevice(false);
    }
  };

  const handlePhoneChange = async (value: string) => {
    // Auto-format: ensure phone starts with +
    let formattedPhone = value.trim();
    
    // Remove any non-digit characters except +
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
    setTrustedDevice(null);

    // Only validate when phone has minimum complete length (country code + number)
    // Example: +244 (Angola) + 9 digits = 13 chars minimum
    if (formattedPhone.length >= 13) {
      const result = await validatePhone(formattedPhone);
      if (result.isValid && result.operator) {
        setPhoneOperator(result.operator);
        // Check for trusted device after phone validation
        await checkTrustedDevice(formattedPhone);
      } else {
        setPhoneValidationError(result.error);
      }
    }
  };

  const enforceRoleAccess = async (userId: string) => {
    if (userType !== 'admin' && userType !== 'employee') return;

    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (rolesError) throw rolesError;

    const adminRoles = ['admin', 'admin_national', 'admin_province', 'admin_municipality'];
    const hasAccess =
      userType === 'admin'
        ? (roles?.some((r) => adminRoles.includes(r.role)) ?? false)
        : (roles?.some((r) => r.role === 'moderator') ?? false);

    if (!hasAccess) {
      await supabase.auth.signOut();
      throw new Error(
        userType === 'admin'
          ? 'Acesso negado. Privilégios de administrador necessários.'
          : 'Acesso negado. Privilégios de funcionário necessários.'
      );
    }
  };

  // Quick login using trusted device token with optional biometric verification
  const handleQuickLogin = async () => {
    if (!trustedDevice) return;
    
    setLoading(true);
    try {
      // If biometric is available and credentials are saved, require biometric verification
      if (biometricCapabilities.isAvailable && biometricCapabilities.hasCredentials) {
        const credentials = await authenticateWithBiometric();
        
        if (!credentials) {
          setLoading(false);
          toast({
            title: t('error'),
            description: 'Autenticação biométrica cancelada',
            variant: "destructive",
          });
          return;
        }
        
        // Log biometric login
        await logBiometricLogin();
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/biometric-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone_number: phone,
          device_token: trustedDevice.deviceToken,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Token expired or invalid - clear trusted device
        setTrustedDevice(null);
        throw new Error(data?.error || "Dispositivo não reconhecido. Use OTP para entrar.");
      }

      if (!data.access_token || !data.refresh_token || !data.user) {
        throw new Error("Dados de autenticação incompletos");
      }

      console.log('Setting session with server-verified tokens');
      
      // Set session with tokens verified by the server
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token
      });
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error(`Erro ao estabelecer sessão: ${sessionError.message}`);
      }
      
      console.log('Session established successfully');
      
      // Use user from response
      const user = data.user;

      // Check role permissions
      await enforceRoleAccess(user.id);

      // Update device last used
      await registerDevice(user.id);
      
      localStorage.setItem('afroloc_remember_me', 'true');

      toast({
        title: t('success'),
        description: t('logged_in'),
      });
      
      if (userType === 'admin' || userType === 'employee') {
        navigate("/admin/import-divisions");
      } else {
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!phone) {
      toast({
        title: t('error'),
        description: "Por favor, insira o número de telefone",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-signup-otp', {
        body: { phone }
      });

      if (error) throw error;

      setOtpSent(true);
      if (data?.operator) {
        setPhoneOperator(data.operator);
      }

      const devOtp = (data as any)?.dev_otp_code as string | undefined;
      toast({
        title: t('otp_sent'),
        description: devOtp
          ? `${t('otp_sent_desc')} (Código de teste: ${devOtp})`
          : t('otp_sent_desc'),
      });
    } catch (error: any) {
      const status = (error as any)?.context?.status as number | undefined;
      const body = (error as any)?.context?.body;

      let message = error?.message || "";
      if (body) {
        try {
          const parsed = typeof body === 'string' ? JSON.parse(body) : body;
          if (parsed?.error) message = parsed.error;
        } catch {
          // ignore
        }
      }

      const isRateLimit = status === 429;
      toast({
        title: t('error'),
        description: isRateLimit
          ? (message || t('rate_limit_exceeded') || 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.')
          : (message || t('invalid_phone_operator')),
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
        description: "Por favor, insira o código de 6 dígitos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Use custom phone login edge function
      const { data, error } = await supabase.functions.invoke('phone-login', {
        body: { phone, otp_code: otp }
      });

      // Tratar resposta de erro do edge function
      if (error) {
        console.error('Phone login error:', error);
        
        // O erro pode vir no formato de FunctionsHttpError
        const errorMessage = typeof error === 'string' ? error : error.message;
        
        toast({
          title: "❌ Código incorreto",
          description: errorMessage || "Erro ao verificar código. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      // Verificar se há erro na resposta (mesmo com status 200)
      if (data?.error) {
        const remaining = data.remaining_attempts;
        
        // Máximo de tentativas excedido
        if (remaining === 0 || data.error.includes('bloqueado') || data.error.includes('max_attempts')) {
          toast({
            title: "🚫 Conta bloqueada",
            description: "Máximo de tentativas excedido. Solicite um novo código.",
            variant: "destructive",
            duration: 6000,
          });
          // Reset OTP state to allow user to request new code
          setOtpSent(false);
          setOtp("");
          return;
        }
        
        // Ainda há tentativas restantes
        const attemptText = remaining === 1 ? "tentativa" : "tentativas";
        toast({
          title: "❌ Código incorreto",
          description: `${data.error}\n\nVerifique o código recebido por SMS e tente novamente.`,
          variant: "destructive",
          duration: 5000,
        });
        
        // Limpar campo para nova tentativa
        setOtp("");
        return;
      }

      if (!data?.success) {
        throw new Error(data?.error || "Falha na verificação do código");
      }

      // Establish session using tokens from edge function
      if (data.access_token && data.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token
        });
        
        if (sessionError) {
          console.error("Failed to establish session:", sessionError);
          throw new Error("Erro ao estabelecer sessão");
        }
      } else {
        throw new Error("Tokens de autenticação não retornados pelo servidor");
      }

      // Verify session was established
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error("Failed to get user after verification:", userError);
        throw new Error("Erro ao obter dados do usuário");
      }
      
      // Verificar permissões baseado no tipo de usuário selecionado
      await enforceRoleAccess(user.id);
      
      // Register device
      const trustedDeviceRegistered = await registerDevice(user.id);
      
      // Salvar flag de "lembrar-me" para persistência de sessão
      if (rememberMe) {
        localStorage.setItem('afroloc_remember_me', 'true');
      } else {
        sessionStorage.setItem('afroloc_session_active', 'true');
      }

      setPhoneVerified(true);
      
      // Prompt to save biometric if available and not already saved
      if (biometricCapabilities.isAvailable && !biometricCapabilities.hasCredentials) {
        setShowBiometricPrompt(true);
      } else {
        // Show success toast with trusted device info
        if (trustedDeviceRegistered) {
          toast({
            title: "✅ " + t('success'),
            description: t('logged_in') + " • Dispositivo guardado para login rápido (30 dias)",
            duration: 5000,
          });
        } else {
          toast({
            title: t('success'),
            description: t('logged_in'),
          });
        }
        
        // Redirecionar baseado no tipo de usuário
        if (userType === 'admin' || userType === 'employee') {
          navigate("/admin/import-divisions");
        } else {
          navigate("/dashboard");
        }
      }
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message || "Erro ao verificar código OTP",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const registerDevice = async (userId: string): Promise<boolean> => {
    console.log('registerDevice called - rememberMe:', rememberMe, 'phone:', phone, 'deviceInfo:', !!deviceInfo);
    
    if (!deviceInfo) {
      console.warn('Device info not available for registration');
      return false;
    }

    let trustedDeviceRegistered = false;

    try {
      // Register in user_devices
      const { error: deviceError } = await supabase.from('user_devices').upsert({
        user_id: userId,
        device_name: deviceInfo.deviceName,
        device_type: deviceInfo.deviceType,
        device_fingerprint: deviceInfo.fingerprint,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        user_agent: deviceInfo.userAgent,
        is_trusted: rememberMe,
        last_active_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,device_fingerprint'
      });

      if (deviceError) {
        console.error('Error registering user device:', deviceError);
      }

      // If rememberMe is checked, also register for quick login
      if (rememberMe && phone) {
        const deviceToken = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // Token valid for 30 days

        // First, check if device already exists and update it, or insert new
        const { data: existingDevice } = await supabase
          .from('biometric_devices')
          .select('id')
          .eq('user_id', userId)
          .eq('phone_number', phone)
          .eq('device_fingerprint', deviceInfo.fingerprint)
          .maybeSingle();

        if (existingDevice) {
          // Update existing device
          const { error: updateError } = await supabase
            .from('biometric_devices')
            .update({
              device_token: deviceToken,
              expires_at: expiresAt.toISOString(),
              last_used_at: new Date().toISOString()
            })
            .eq('id', existingDevice.id);

          if (!updateError) {
            trustedDeviceRegistered = true;
          } else {
            console.error('Error updating trusted device:', updateError);
          }
        } else {
          // Insert new device
          const { error: insertError } = await supabase.from('biometric_devices').insert({
            user_id: userId,
            phone_number: phone,
            device_token: deviceToken,
            device_fingerprint: deviceInfo.fingerprint,
            device_name: deviceInfo.deviceName,
            device_type: deviceInfo.deviceType,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            biometry_type: 'trusted_device',
            expires_at: expiresAt.toISOString(),
            last_used_at: new Date().toISOString()
          });

          if (!insertError) {
            trustedDeviceRegistered = true;
          } else {
            console.error('Error inserting trusted device:', insertError);
          }
        }
      }
    } catch (error) {
      console.error('Error registering device:', error);
    }

    return trustedDeviceRegistered;
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Verificar permissões baseado no tipo de usuário selecionado
        await enforceRoleAccess(data.user.id);

        await registerDevice(data.user.id);
        
        // Salvar flag de "lembrar-me" para persistência de sessão
        if (rememberMe) {
          localStorage.setItem('afroloc_remember_me', 'true');
        } else {
          sessionStorage.setItem('afroloc_session_active', 'true');
        }
      }

      // Salvar credenciais para biometria se disponível
      if (biometricCapabilities.isAvailable && !biometricCapabilities.hasCredentials) {
        await saveBiometricCredentials(email, password);
      }

      toast({
        title: t('success'),
        description: t('logged_in'),
      });
      
      // Redirecionar baseado no tipo de usuário
      if (userType === 'admin' || userType === 'employee') {
        navigate("/admin/import-divisions");
      } else {
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const credentials = await authenticateWithBiometric();
      
      if (!credentials) {
        toast({
          title: t('error'),
          description: 'Autenticação biométrica cancelada',
          variant: "destructive",
        });
        return;
      }

      setLoading(true);
      
      // Check if it's phone or email biometric (phone starts with +)
      if (credentials.email.startsWith('+')) {
        // Phone biometric login
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/biometric-login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone_number: credentials.email,
            device_token: credentials.password,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data?.error || "Falha na autenticação biométrica");
        }

        if (data.access_token && data.refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token
          });
          
          if (sessionError) {
            throw new Error("Erro ao estabelecer sessão");
          }
        }
      } else {
        // Email biometric login
        const { data, error } = await supabase.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });

        if (error) throw error;

        if (data.user) {
          // Verificar permissões baseado no tipo de usuário selecionado
          await enforceRoleAccess(data.user.id);
          
          await registerDevice(data.user.id);
        }
      }

      // Biometric login sempre marca como "lembrar-me"
      localStorage.setItem('afroloc_remember_me', 'true');

      // Log biometric login
      await logBiometricLogin();

      toast({
        title: t('success'),
        description: t('logged_in'),
      });
      
      // Redirecionar baseado no tipo de usuário
      if (userType === 'admin' || userType === 'employee') {
        navigate("/admin/import-divisions");
      } else {
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBiometric = async () => {
    if (!deviceInfo) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-biometric-device`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          phone_number: phone,
          device_name: deviceInfo.deviceName,
          device_type: deviceInfo.deviceType,
          device_fingerprint: deviceInfo.fingerprint,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          biometry_type: getBiometricLabel(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data?.error || "Falha ao registrar dispositivo");
      }

      // Save phone and device token to biometric storage
      await saveBiometricCredentials(phone, data.device_token);

      toast({
        title: t('success'),
        description: `${getBiometricLabel()} ativada com sucesso!`,
      });
      setShowBiometricPrompt(false);
      
      // Redirecionar baseado no tipo de usuário
      if (userType === 'admin' || userType === 'employee') {
        navigate("/admin/import-divisions");
      } else {
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error("Save biometric error:", error);
      toast({
        title: t('error'),
        description: error.message || "Erro ao ativar biometria",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkipBiometric = () => {
    setShowBiometricPrompt(false);
    toast({
      title: t('success'),
      description: t('logged_in'),
    });
    
    // Redirecionar baseado no tipo de usuário
    if (userType === 'admin' || userType === 'employee') {
      navigate("/admin/import-divisions");
    } else {
      navigate("/dashboard");
    }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // OTP verification now handles the full login, so this is just a fallback
    if (!phoneVerified) {
      toast({
        title: t('error'),
        description: "Por favor, verifique seu telefone primeiro",
        variant: "destructive",
      });
    }
  };


  // Show biometric prompt after phone login
  if (showBiometricPrompt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="fixed inset-0 bg-gradient-mesh opacity-40 -z-10"></div>
        <Card className="w-full max-w-md glass-strong border border-border/50 shadow-premium">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Fingerprint className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-display">
              Ativar {getBiometricLabel()}?
            </CardTitle>
            <CardDescription>
              Faça login mais rápido usando {getBiometricLabel()} nas próximas vezes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleSaveBiometric}
              disabled={loading}
              className="w-full bg-gradient-primary hover:scale-105 transition-all"
            >
              <Fingerprint className="mr-2 h-4 w-4" />
              Ativar {getBiometricLabel()}
            </Button>
            <Button
              onClick={handleSkipBiometric}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              Agora não
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de seleção de tipo de usuário
  if (!userType) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        {/* Background effects */}
        <div className="fixed inset-0 bg-gradient-mesh opacity-40 -z-10"></div>
        <div className="fixed -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10 animate-float"></div>
        <div className="fixed -bottom-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl -z-10 animate-float" style={{ animationDelay: '1s' }}></div>
        
        <div className="absolute top-4 left-4 animate-fade-in">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="glass hover:shadow-glow transition-all gap-2"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Recuar</span>
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
            <CardTitle className="text-3xl font-display">{t('select_access_type')}</CardTitle>
            <CardDescription className="text-base">
              {t('select_access_description')}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-3">
            <Button
              onClick={() => setUserType('citizen')}
              variant="outline"
              className="w-full h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary transition-all"
            >
              <User className="h-8 w-8 text-primary" />
              <div className="text-center">
                <div className="font-semibold text-lg">{t('user_type_citizen')}</div>
                <div className="text-xs text-muted-foreground">{t('user_type_citizen_desc')}</div>
              </div>
            </Button>
            
            <Button
              onClick={() => setUserType('employee')}
              variant="outline"
              className="w-full h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary transition-all"
            >
              <Briefcase className="h-8 w-8 text-primary" />
              <div className="text-center">
                <div className="font-semibold text-lg">{t('user_type_employee')}</div>
                <div className="text-xs text-muted-foreground">{t('user_type_employee_desc')}</div>
              </div>
            </Button>
            
            <Button
              onClick={() => setUserType('admin')}
              variant="outline"
              className="w-full h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary transition-all"
            >
              <Shield className="h-8 w-8 text-primary" />
              <div className="text-center">
                <div className="font-semibold text-lg">{t('user_type_admin')}</div>
                <div className="text-xs text-muted-foreground">{t('user_type_admin_desc')}</div>
              </div>
            </Button>
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-2">
            <div className="text-center text-sm text-muted-foreground">
              {t('no_account')}{" "}
              <Link to="/pre-signup" className="text-primary hover:underline font-medium">
                {t('register')}
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 bg-gradient-mesh opacity-40 -z-10"></div>
      <div className="fixed -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10 animate-float"></div>
      <div className="fixed -bottom-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl -z-10 animate-float" style={{ animationDelay: '1s' }}></div>
      
      <div className="absolute top-4 left-4 animate-fade-in">
        <Button
          variant="ghost"
          onClick={() => setUserType(null)}
          className="glass hover:shadow-glow transition-all gap-2"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Recuar</span>
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
          <CardTitle className="text-3xl font-display">
            {userType === 'admin' && 'Acesso Administrativo'}
            {userType === 'employee' && 'Acesso de Funcionário'}
            {userType === 'citizen' && t('welcome_afroloc')}
          </CardTitle>
          <CardDescription className="text-base">
            {userType === 'admin' && 'Área restrita - Administradores autorizados'}
            {userType === 'employee' && 'Área restrita - Funcionários autorizados'}
            {userType === 'citizen' && t('login_description')}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Biometric Login Button - Apenas para Usuários */}
          {userType === 'citizen' && (
            <>
              {biometricCapabilities.isAvailable && biometricCapabilities.hasCredentials && (
                <div className="space-y-3">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Ou
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="default"
                    className="w-full"
                    onClick={handleBiometricLogin}
                    disabled={biometricLoading || loading}
                  >
                    <Fingerprint className="mr-2 h-4 w-4" />
                    Login com {getBiometricLabel()}
                  </Button>
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t('or_continue_with')}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Email/Phone Login Tabs */}
          <Tabs value={loginMethod} onValueChange={(v) => setLoginMethod(v as "email" | "phone")}>
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
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('email_placeholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t('password')}</Label>
                    <Link 
                      to="/forgot-password" 
                      className="text-sm text-primary hover:underline"
                    >
                      {t('forgot_password')}
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${rememberMe ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}>
                  <Checkbox 
                    id="remember" 
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <label
                    htmlFor="remember"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                  >
                    {t('remember_me')}
                    {rememberMe && (
                      <span className="block text-xs text-primary mt-1">
                        ✓ O dispositivo será guardado para login rápido
                      </span>
                    )}
                  </label>
                </div>

                <Button type="submit" className="w-full bg-gradient-primary hover:scale-105 shadow-elegant hover:shadow-glow transition-all" disabled={loading}>
                  <LogIn className="mr-2 h-4 w-4" />
                  {loading ? t('signing_in') : t('sign_in')}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="phone" className="space-y-4 mt-4">
              <form onSubmit={handlePhoneLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">{t('phone_number')}</Label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="phoneNumber"
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
                    
                    {/* Quick Login for Trusted Device */}
                    {trustedDevice && !otpSent && (
                      <div className="space-y-3 pt-2">
                        <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                          <div className="flex items-center gap-2 text-sm">
                            {biometricCapabilities.isAvailable && biometricCapabilities.hasCredentials ? (
                              <Fingerprint className="h-4 w-4 text-primary" />
                            ) : (
                              <Smartphone className="h-4 w-4 text-primary" />
                            )}
                            <span className="font-medium text-primary">{t('trusted_device_detected') || 'Dispositivo reconhecido'}</span>
                          </div>
                          {trustedDevice.deviceName && (
                            <p className="text-sm font-medium mt-1">
                              {trustedDevice.deviceName}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {biometricCapabilities.isAvailable && biometricCapabilities.hasCredentials
                              ? (t('biometric_login_available') || `Login com ${getBiometricLabel()} disponível`)
                              : (t('quick_login_available') || 'Login rápido disponível para este dispositivo')}
                          </p>
                        </div>
                        <Button 
                          type="button" 
                          onClick={handleQuickLogin}
                          disabled={loading || checkingDevice || biometricLoading}
                          className="w-full bg-gradient-primary hover:scale-105 shadow-elegant hover:shadow-glow transition-all"
                        >
                          {biometricCapabilities.isAvailable && biometricCapabilities.hasCredentials ? (
                            <Fingerprint className="mr-2 h-4 w-4" />
                          ) : (
                            <Smartphone className="mr-2 h-4 w-4" />
                          )}
                          {loading 
                            ? t('signing_in') 
                            : biometricCapabilities.isAvailable && biometricCapabilities.hasCredentials
                              ? (t('login_with_biometric') || `Entrar com ${getBiometricLabel()}`)
                              : (t('quick_login') || 'Entrar Rápido')}
                        </Button>
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <Separator className="w-full" />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">
                              {t('or_use_otp') || 'Ou usar código OTP'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {checkingDevice && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span>{t('checking_device') || 'Verificando dispositivo...'}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${rememberMe ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}>
                  <Checkbox 
                    id="remember-phone" 
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <label
                    htmlFor="remember-phone"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                  >
                    {t('remember_me')}
                    {rememberMe && (
                      <span className="block text-xs text-primary mt-1">
                        ✓ O dispositivo será guardado para login rápido
                      </span>
                    )}
                  </label>
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
                          autoComplete="one-time-code"
                        />
                        <Button 
                          type="button" 
                          onClick={handleVerifyOTP}
                          disabled={loading || otp.length !== 6}
                        >
                          {t('verify_otp')}
                        </Button>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>💡 Digite o código de 6 dígitos recebido por SMS</p>
                        <p>⏱️ Código expira em 10 minutos</p>
                        <p>🔢 3 tentativas antes de solicitar novo código</p>
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
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          {userType === 'citizen' && (
            <p className="text-sm text-center text-muted-foreground">
              {t('no_account')}{" "}
              <Link to="/signup" className="text-primary hover:underline">
                {t('sign_up')}
              </Link>
            </p>
          )}
          {(userType === 'admin' || userType === 'employee') && (
            <p className="text-sm text-center text-muted-foreground">
              Apenas usuários autorizados podem acessar esta área.
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
