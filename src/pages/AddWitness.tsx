import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, UserPlus, CheckCircle2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/contexts/LanguageContext";

// AFROLOC formats supported:
// New format: AO-TAL-TAL-VID-G10-2ZP1-N1FTR (using hyphens)
// Legacy format: AO.LUA.VIA.ZAN.BK2.0041 (using dots)
const witnessSchema = z.object({
  witness_afro_id: z
    .string()
    .trim()
    .min(1, "AFROLOC is required")
    .max(100, "AFROLOC must be less than 100 characters")
    .regex(/^[A-Z]{2}[-\.][A-Z0-9]{2,4}[-\.][A-Z0-9]{2,4}/i, "Invalid AFROLOC format"),
});

export default function AddWitness() {
  const { id } = useParams<{ id: string }>();
  const [witnessAfroId, setWitnessAfroId] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login");
      return;
    }
    setUserId(session.user.id);
  };

  const validateForm = () => {
    try {
      witnessSchema.parse({ witness_afro_id: witnessAfroId });
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Validate that the witness AFROLOC exists and is active
      const { data: witnessRecord, error: witnessCheckError } = await supabase
        .from("afroloc_records")
        .select("user_id, status, code, id")
        .eq("code", witnessAfroId)
        .maybeSingle();

      if (witnessCheckError) {
        console.error("Error checking witness AFROLOC:", witnessCheckError);
        throw new Error("Error validating witness AFROLOC");
      }

      if (!witnessRecord) {
        toast({
          title: t('addwitness_toast_invalid_witness_title'),
          description: t('addwitness_toast_invalid_witness_desc'),
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (witnessRecord.status !== "verified" && witnessRecord.status !== "certified") {
        toast({
          title: t('addwitness_toast_not_active_title'),
          description: t('addwitness_toast_not_active_desc'),
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // CRITICAL: Validate that the witness has address validations
      const { data: witnessValidations, error: validationError } = await supabase
        .from("afroloc_validations")
        .select("id, validation_method")
        .eq("afroloc_record_id", witnessRecord.id)
        .in("validation_method", ["authority", "witness"]);

      if (validationError) {
        console.error("Error checking witness validations:", validationError);
        throw new Error("Erro ao verificar validações da testemunha");
      }

      if (!witnessValidations || witnessValidations.length === 0) {
        toast({
          title: t('addwitness_toast_address_not_validated_title'),
          description: t('addwitness_toast_address_not_validated_desc'),
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Check if user is trying to add themselves as witness
      if (witnessRecord.user_id === user.id) {
        toast({
          title: t('addwitness_toast_validation_error_title'),
          description: t('addwitness_toast_cannot_add_self_desc'),
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Check if witness already exists
      const { data: existing } = await supabase
        .from("afroloc_witnesses")
        .select("id")
        .eq("afroloc_record_id", id)
        .eq("witness_afro_id", witnessAfroId)
        .maybeSingle();

      if (existing) {
        toast({
          title: t('addwitness_toast_duplicate_title'),
          description: t('addwitness_toast_duplicate_desc'),
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Create witness record with the actual witness user_id
      const { data: newWitness, error } = await supabase.from("afroloc_witnesses").insert({
        afroloc_record_id: id!,
        witness_afro_id: witnessAfroId,
        witness_user_id: witnessRecord.user_id,
        status: "pending",
      }).select().single();

      if (error) throw error;

      // Get the record details
      const { data: record } = await supabase
        .from("afroloc_records")
        .select("code")
        .eq("id", id)
        .maybeSingle();

      // Get witness profile to get email
      const { data: witnessProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", witnessRecord.user_id)
        .maybeSingle();

      // Generate and send OTP to the actual witness
      // The edge function will look up witness email internally
      const { data: otpData, error: otpError } = await supabase.functions.invoke("send-witness-otp", {
        body: {
          witness_id: newWitness.id,
          witness_user_id: witnessRecord.user_id,
          afroloc_code: record?.code,
        },
      });

      if (otpError) {
        console.error("Error sending OTP:", otpError);
        toast({
          title: t('addwitness_toast_warning_title'),
          description: t('addwitness_toast_notification_failed_desc'),
          variant: "destructive",
        });
      } else {
        toast({
          title: t('addwitness_toast_success_title'),
          description: t('addwitness_toast_success_desc'),
        });
      }
      
      navigate(`/identity/${id}`);
    } catch (error: any) {
      toast({
        title: t('addwitness_toast_error_title'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="w-full max-w-2xl mx-auto space-y-4 sm:space-y-6 px-0">
        <div className="flex items-start gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/identity/${id}`)} className="flex-shrink-0">
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground break-words">{t('addwitness_title')}</h1>
            <p className="text-muted-foreground text-sm sm:text-base break-words">{t('addwitness_subtitle')}</p>
          </div>
        </div>

        <Alert className="border-primary/50 bg-primary/5">
          <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
          <AlertDescription className="text-xs sm:text-sm break-words">
            <strong>{t('addwitness_process_label')}</strong> {t('addwitness_process_intro')}
            <span className="font-mono mx-1">1) SIM</span> {t('addwitness_process_or')} <span className="font-mono mx-1">2) NÃO</span>.
            {t('addwitness_process_outro')}
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl">{t('addwitness_card_title')}</CardTitle>
            <CardDescription className="text-xs sm:text-sm break-words">
              {t('addwitness_card_desc')}
              <strong className="text-foreground"> {t('addwitness_card_desc_emphasis')}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <Label htmlFor="witness_afro_id" className="text-sm sm:text-base">
                  {t('addwitness_field_label')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="witness_afro_id"
                  value={witnessAfroId}
                  onChange={(e) => {
                    setWitnessAfroId(e.target.value.toUpperCase());
                    setErrors({});
                  }}
                  placeholder={t('addwitness_field_placeholder')}
                  className={`text-sm sm:text-base ${errors.witness_afro_id ? "border-destructive" : ""}`}
                  maxLength={100}
                />
                {errors.witness_afro_id && (
                  <p className="text-xs sm:text-sm text-destructive break-words">{errors.witness_afro_id}</p>
                )}
                <p className="text-xs sm:text-sm text-muted-foreground break-words">
                  {t('addwitness_field_format_hint')}
                </p>
              </div>

              <Alert className="border-amber-500/50 bg-amber-500/5">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 flex-shrink-0" />
                <AlertDescription>
                  <h3 className="font-semibold mb-2 text-foreground text-sm sm:text-base">{t('addwitness_requirements_heading')}</h3>
                  <ul className="space-y-2 text-xs sm:text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="break-words"><strong>{t('addwitness_req_active_label')}</strong> {t('addwitness_req_active_text')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="break-words"><strong>{t('addwitness_req_validated_label')}</strong> {t('addwitness_req_validated_text')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="break-words"><strong>{t('addwitness_req_proximity_label')}</strong> {t('addwitness_req_proximity_text')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="break-words"><strong>{t('addwitness_req_sms_label')}</strong> {t('addwitness_req_sms_text')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="break-words"><strong>{t('addwitness_req_minimum_label')}</strong> {t('addwitness_req_minimum_text')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-destructive mt-0.5 flex-shrink-0" />
                      <span className="break-words"><strong>{t('addwitness_req_restriction_label')}</strong> {t('addwitness_req_restriction_text')}</span>
                    </li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/identity/${id}`)}
                  className="flex-1 text-sm sm:text-base"
                >
                  {t('addwitness_btn_cancel')}
                </Button>
                <Button type="submit" disabled={loading} className="flex-1 text-sm sm:text-base">
                  <UserPlus className="mr-2 h-4 w-4" />
                  {loading ? t('addwitness_btn_submitting') : t('addwitness_btn_submit')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
