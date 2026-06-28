import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Phone, Shield } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { z } from "zod";

const phoneSchema = z.string()
  .trim()
  .min(10, "Número de telefone deve ter pelo menos 10 dígitos")
  .max(20, "Número de telefone deve ter menos de 20 caracteres")
  .regex(/^\+?[1-9]\d{9,14}$/, "Formato inválido. Use o formato internacional: +244912345678")
  .refine(
    (phone) => phone.startsWith('+'),
    { message: "Número deve começar com + e código do país" }
  );

const otpSchema = z.string()
  .trim()
  .length(6, "OTP deve ter 6 dígitos")
  .regex(/^\d{6}$/, "OTP deve conter apenas números");

export default function ChangePhone() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [newPhone, setNewPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const handlePhoneChange = (value: string) => {
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
    
    setNewPhone(formattedPhone);
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone
    const phoneValidation = phoneSchema.safeParse(newPhone);
    if (!phoneValidation.success) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: phoneValidation.error.issues[0].message,
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/login");
        return;
      }

      const { data, error } = await supabase.functions.invoke("send-change-phone-otp", {
        body: { new_phone: newPhone },
      });

      if (error) throw error;

      // Handle cooldown period
      if (data?.cooldown_active) {
        toast({
          variant: "destructive",
          title: t("phone_change_cooldown_active"),
          description: data.message || t("phone_change_cooldown_message").replace("{days}", data.days_remaining),
          duration: 8000,
        });
        return;
      }

      // Handle rate limiting
      if (data?.rate_limit_exceeded) {
        toast({
          variant: "destructive",
          title: t("phone_change_rate_limit_title"),
          description: data.error,
          duration: 6000,
        });
        return;
      }

      if (data?.success) {
        setExpiresAt(data.expires_at);
        setStep("otp");
        toast({
          title: t("success"),
          description: t("otp_sent_to_phone"),
        });
      }
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      toast({
        variant: "destructive",
        title: t("error"),
        description: error.message || t("failed_to_send_otp"),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate OTP
    const otpValidation = otpSchema.safeParse(otpCode);
    if (!otpValidation.success) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: otpValidation.error.issues[0].message,
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/login");
        return;
      }

      const { data, error } = await supabase.functions.invoke("verify-change-phone-otp", {
        body: { 
          new_phone: newPhone,
          otp_code: otpCode 
        },
      });

      if (error) throw error;

      // Handle rate limiting
      if (data?.rate_limit_exceeded) {
        toast({
          variant: "destructive",
          title: t("phone_change_rate_limit_title"),
          description: data.error,
          duration: 6000,
        });
        return;
      }

      if (data?.success) {
        toast({
          title: t("success"),
          description: t("phone_changed_successfully"),
        });
        toast({
          title: t("important"),
          description: t("phone_change_notification_sent"),
          variant: "default",
        });
        navigate("/profile");
      }
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      toast({
        variant: "destructive",
        title: t("error"),
        description: error.message || t("failed_to_verify_otp"),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container max-w-md py-8 px-4">
        <Button
          variant="ghost"
          onClick={() => step === "otp" ? setStep("phone") : navigate("/profile")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("back")}
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">{t("change_phone_number")}</CardTitle>
                <CardDescription>
                  {step === "phone" 
                    ? t("enter_new_phone_description")
                    : t("enter_otp_description")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {step === "phone" ? (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex gap-3">
                    <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        {t("important")}
                      </p>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        {t("change_phone_warning")}
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                        ℹ️ {t("phone_change_notifications_info")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new_phone">{t("new_phone_number")}</Label>
                  <Input
                    id="new_phone"
                    type="tel"
                    placeholder="+244912345678"
                    value={newPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("include_country_code")}
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("sending")}
                    </>
                  ) : (
                    t("send_verification_code")
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    {t("code_sent_to")}: <span className="font-semibold text-foreground">{newPhone}</span>
                  </p>
                  {expiresAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("code_expires_in_10_minutes")}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="otp_code">{t("verification_code")}</Label>
                  <Input
                    id="otp_code"
                    type="text"
                    placeholder="123456"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    required
                    className="text-center text-2xl tracking-widest"
                  />
                </div>

                <div className="space-y-2">
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("verifying")}
                      </>
                    ) : (
                      t("verify_and_change")
                    )}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setStep("phone")}
                    disabled={loading}
                  >
                    {t("use_different_number")}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
