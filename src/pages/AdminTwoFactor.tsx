import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, Mail, Smartphone, RefreshCw, ArrowLeft } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import afrolocSymbol from "@/assets/afroloc-symbol.png";

export default function AdminTwoFactor() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

  const userId = location.state?.userId;
  const email = location.state?.email;
  const phone = location.state?.phone;
  const method = location.state?.method || 'email';

  useEffect(() => {
    if (!userId) {
      navigate("/admin/login");
    }
  }, [userId, navigate]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("verify-admin-2fa", {
        body: { userId, code: code.trim() },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: t('twofa_verify_success_title'),
          description: t('twofa_verify_success_desc'),
        });
        navigate("/admin/import-divisions");
      } else {
        throw new Error(data.error || t('twofa_verify_failed_generic'));
      }
    } catch (error: any) {
      toast({
        title: t('twofa_verify_failed_title'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    
    try {
      const { error } = await supabase.functions.invoke("send-admin-2fa", {
        body: { 
          userId, 
          method, 
          email: method === 'email' ? email : undefined,
          phone: method === 'sms' ? phone : undefined
        },
      });

      if (error) throw error;

      toast({
        title: t('twofa_resent_title'),
        description: `${t('twofa_resent_desc')} ${method}`,
      });

      setCountdown(60); // 60 second cooldown
    } catch (error: any) {
      toast({
        title: t('twofa_resend_failed_title'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/10 to-muted/30 p-4">
      <div className="absolute top-4 left-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/login")}
          title={t('twofa_back_to_login')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>

      <Card className="w-full max-w-md border-primary/20 shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <img src={afrolocSymbol} alt="AFROLOC" className="h-14 w-14 object-cover rounded-xl shadow-md ring-1 ring-primary/20" />
              <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1.5">
                <Shield className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{t('twofa_title')}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {t('twofa_description')} {method === 'email' ? t('twofa_channel_email') : t('twofa_channel_phone')}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleVerify}>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center gap-2 p-3 bg-muted/50 rounded-md text-sm">
              {method === 'email' ? (
                <>
                  <Mail className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">{email}</span>
                </>
              ) : (
                <>
                  <Smartphone className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">{phone}</span>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">{t('twofa_code_label')}</Label>
              <Input
                id="code"
                type="text"
                placeholder={t('twofa_code_placeholder')}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
                className="text-center text-2xl tracking-widest font-mono"
                autoComplete="one-time-code"
                autoFocus
              />
            </div>

            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={handleResend}
                disabled={resending || countdown > 0}
                className="text-sm"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${resending ? 'animate-spin' : ''}`} />
                {countdown > 0
                  ? `${t('twofa_resend_in')} ${countdown}s`
                  : resending
                    ? t('twofa_sending')
                    : t('twofa_resend_code')
                }
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              <p className="mb-2">{t('twofa_lost_access')}</p>
              <Button
                type="button"
                variant="link"
                onClick={() => navigate('/admin/2fa-backup', { state: { userId, email, phone } })}
                className="text-sm text-primary"
              >
                {t('twofa_use_backup')}
              </Button>
            </div>

            <div className="bg-muted/50 border border-border rounded-md p-3 text-xs text-muted-foreground">
              <p className="flex items-start gap-2">
                <Shield className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>
                  {t('twofa_expiry_notice')}
                </span>
              </p>
            </div>
          </CardContent>

          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
              {loading ? t('twofa_verifying') : t('twofa_verify_continue')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
