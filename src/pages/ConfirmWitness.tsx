import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from '@/contexts/LanguageContext';
import { CheckCircle, Shield, FileText } from "lucide-react";
import afrolocSymbol from "@/assets/afroloc-symbol.png";

const witnessSchema = z.object({
  otp: z
    .string()
    .trim()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d+$/, "OTP must contain only numbers"),
  fullName: z.string().trim().min(3, "Name must be at least 3 characters"),
  signature: z.string().trim().min(3, "Signature is required"),
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: "You must agree to the terms",
  }),
});

export default function ConfirmWitness() {
  const { witnessId } = useParams<{ witnessId: string }>();
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [signature, setSignature] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const validateForm = () => {
    try {
      witnessSchema.parse({ otp, fullName, signature, agreeToTerms });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach((issue) => {
          if (issue.path[0]) {
            newErrors[issue.path[0] as string] = issue.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      console.log("Verifying OTP for witness:", witnessId);

      const { data, error } = await supabase.functions.invoke("verify-witness-otp", {
        body: {
          witness_id: witnessId,
          otp_code: otp,
          full_name: fullName,
          signature: signature,
        },
      });

      if (error) {
        console.error("Function error:", error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to verify OTP");
      }

      console.log("OTP verified successfully");
      setVerified(true);

      toast({
        title: t('confwitness_toast_success_title'),
        description: t('confwitness_toast_success_desc'),
      });

      setTimeout(() => {
        navigate("/identities");
      }, 3000);
    } catch (error: any) {
      console.error("Verification error:", error);
      toast({
        title: t('confwitness_toast_error_title'),
        description: error.message || t('confwitness_toast_error_desc'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">{t('confwitness_confirmed_title')}</CardTitle>
            <CardDescription>
              {t('confwitness_confirmed_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              {t('confwitness_confirmed_body')}
            </p>
            <Button onClick={() => navigate("/identities")} className="w-full">
              {t('confwitness_go_to_afrolocs')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-3 sm:p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center p-4 sm:p-6">
          <div className="flex justify-center mb-3 sm:mb-4">
            <img src={afrolocSymbol} alt="AFROLOC" className="h-12 w-12 sm:h-14 sm:w-14 object-cover rounded-xl shadow-md ring-1 ring-primary/20" />
          </div>
          <CardTitle className="text-xl sm:text-2xl">{t('confwitness_title')}</CardTitle>
          <CardDescription className="text-sm">
            {t('confwitness_subtitle')}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
            {/* Legal Contract Section */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                <h3 className="font-semibold text-sm sm:text-base">{t('confwitness_contract_heading')}</h3>
              </div>
              
              <ScrollArea className="h-40 sm:h-48 rounded-md border border-border p-3 sm:p-4 bg-muted/30">
                <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-foreground/90 pr-2 sm:pr-4">
                  <p className="font-semibold">{t('confwitness_contract_termo')}</p>

                  <p>
                    {t('confwitness_contract_intro')}
                  </p>

                  <ol className="list-decimal list-inside space-y-2 ml-2">
                    <li>{t('confwitness_contract_item1')}</li>
                    <li>{t('confwitness_contract_item2')}</li>
                    <li>{t('confwitness_contract_item3')}</li>
                    <li>{t('confwitness_contract_item4')}</li>
                    <li>{t('confwitness_contract_item5')}</li>
                    <li>{t('confwitness_contract_item6')}</li>
                  </ol>

                  <p className="text-muted-foreground italic">
                    {t('confwitness_contract_footer')}
                  </p>
                </div>
              </ScrollArea>
            </div>

            {/* Full Name Field */}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm">
                {t('confwitness_label_fullname')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setErrors({});
                }}
                placeholder={t('confwitness_placeholder_fullname')}
                className={`text-sm sm:text-base ${errors.fullName ? "border-destructive" : ""}`}
              />
              {errors.fullName && (
                <p className="text-xs sm:text-sm text-destructive break-words">{errors.fullName}</p>
              )}
            </div>

            {/* Agreement Checkbox */}
            <div className="flex items-start space-x-2 sm:space-x-3 rounded-lg border border-border p-3 sm:p-4 bg-muted/50">
              <Checkbox
                id="agreeToTerms"
                checked={agreeToTerms}
                onCheckedChange={(checked) => {
                  setAgreeToTerms(checked as boolean);
                  setErrors({});
                }}
                className={`flex-shrink-0 ${errors.agreeToTerms ? "border-destructive" : ""}`}
              />
              <div className="space-y-1 leading-none flex-1 min-w-0">
                <Label
                  htmlFor="agreeToTerms"
                  className="text-xs sm:text-sm font-medium cursor-pointer break-words"
                >
                  {t('confwitness_agree_label')} <span className="text-destructive">*</span>
                </Label>
                {errors.agreeToTerms && (
                  <p className="text-xs sm:text-sm text-destructive break-words">{errors.agreeToTerms}</p>
                )}
              </div>
            </div>

            {/* Signature Field */}
            <div className="space-y-2">
              <Label htmlFor="signature" className="text-sm">
                {t('confwitness_label_signature')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="signature"
                type="text"
                value={signature}
                onChange={(e) => {
                  setSignature(e.target.value);
                  setErrors({});
                }}
                placeholder={t('confwitness_placeholder_signature')}
                className={`italic text-sm sm:text-base ${errors.signature ? "border-destructive" : ""}`}
              />
              {errors.signature && (
                <p className="text-xs sm:text-sm text-destructive break-words">{errors.signature}</p>
              )}
              <p className="text-xs text-muted-foreground break-words">
                {t('confwitness_signature_hint')}
              </p>
            </div>

            {/* OTP Field */}
            <div className="space-y-2">
              <Label htmlFor="otp" className="text-sm">
                {t('confwitness_label_otp')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={6}
                value={otp}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  setOtp(value);
                  setErrors({});
                }}
                placeholder="000000"
                className={`text-center text-xl sm:text-2xl font-bold tracking-widest ${
                  errors.otp ? "border-destructive" : ""
                }`}
              />
              {errors.otp && (
                <p className="text-xs sm:text-sm text-destructive text-center break-words">{errors.otp}</p>
              )}
              <p className="text-xs sm:text-sm text-muted-foreground text-center break-words">
                {t('confwitness_otp_hint')}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/50 p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm flex-1 min-w-0">
                  <p className="font-semibold mb-1">{t('confwitness_responsibility_title')}</p>
                  <p className="text-muted-foreground break-words">
                    {t('confwitness_responsibility_body')}
                  </p>
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={loading || otp.length !== 6 || !agreeToTerms || !fullName || !signature} 
              className="w-full text-sm sm:text-base mt-4"
            >
              {loading ? t('confwitness_btn_loading') : t('confwitness_btn_submit')}
            </Button>

            <p className="text-center text-xs sm:text-sm text-muted-foreground">
              {t('confwitness_resend_question')}{" "}
              <button
                type="button"
                className="text-primary hover:underline font-medium"
                onClick={() => {
                  toast({
                    title: t('confwitness_toast_resend_title'),
                    description: t('confwitness_toast_resend_desc'),
                  });
                }}
              >
                {t('confwitness_resend_link')}
              </button>
            </p>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
