import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShieldCheck, Phone, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// Confirmação do registo pelo cidadão (v1 do mecanismo de pré-autorização):
// a autoridade AUTORIZA o endereço (allowlist); aqui o DONO ativa (resgata).
// Nunca cria confiança — só reflete a decisão já tomada pela autoridade.
interface Props {
  record: { id: string; code: string; status: string; user_id: string };
  currentUserId: string;
  onConfirmed: () => void;
}

export function RegistrationConfirmation({ record, currentUserId, onConfirmed }: Props) {
  const { t } = useLanguage();
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState(record.code);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<null | "not_authorized" | "not_found">(null);

  const isOwner = !!currentUserId && currentUserId === record.user_id;
  const alreadyCertified = record.status === "certified";

  useEffect(() => {
    supabase
      .from("validation_phone_numbers")
      .select("phone_number")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setPhone(data?.phone_number ?? null));
  }, []);

  if (!isOwner || alreadyCertified) return null;

  const confirmar = async () => {
    setBusy(true);
    setState(null);
    try {
      const { data, error } = await supabase.rpc("redeem_afroloc_authorization", { p_code: code });
      if (error) throw error;
      const st = (data as { status?: string })?.status;
      if (st === "confirmed") {
        toast.success(t("regconf_confirmed"));
        onConfirmed();
      } else if (st === "not_authorized") {
        setState("not_authorized");
      } else if (st === "not_found" || st === "not_yours") {
        setState("not_found");
      } else {
        toast.error(t("regconf_error"));
      }
    } catch (e) {
      toast.error((e as Error)?.message || t("regconf_error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          {t("regconf_title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {phone && (
          <p className="text-sm text-muted-foreground">
            {t("regconf_hint_send")}{" "}
            <a
              href={`https://wa.me/${phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Phone className="h-3.5 w-3.5" /> {phone}
            </a>
          </p>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">{t("regconf_code_label")}</label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" />
        </div>

        {state === "not_authorized" && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-100/60 dark:bg-amber-900/30 p-3 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <span>{t("regconf_not_authorized")}</span>
          </div>
        )}
        {state === "not_found" && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <span>{t("regconf_not_found")}</span>
          </div>
        )}

        <Button onClick={confirmar} disabled={busy || !code.trim()} className="w-full gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {t("regconf_button")}
        </Button>
      </CardContent>
    </Card>
  );
}
