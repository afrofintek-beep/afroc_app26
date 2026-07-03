import { useState, useEffect } from "react";
import { Copy, QrCode, Share2, MapPin, AlertCircle, Loader2, ShieldCheck, Users, FileCheck, Navigation, CheckCircle2, XCircle, Clock, Timer } from "lucide-react";
import QRCodeLib from "qrcode";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { ATSScoreBadge } from "@/components/ATSScoreBadge";

type AfrolocRecord = Database["public"]["Tables"]["afroloc_records"]["Row"] & {
  is_temporary?: boolean;
  temporary_expires_at?: string | null;
  temporary_granted_by?: string | null;
  temporary_validity_days?: number | null;
};
type AfrolocWitness = Database["public"]["Tables"]["afroloc_witnesses"]["Row"];
type AfrolocValidation = Database["public"]["Tables"]["afroloc_validations"]["Row"];

function getTemporaryDaysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function MyAfroloc() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [record, setRecord] = useState<AfrolocRecord | null>(null);
  const [witnesses, setWitnesses] = useState<AfrolocWitness[]>([]);
  const [validations, setValidations] = useState<AfrolocValidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      // Fetch approved or temporary records
      const { data: rec } = await supabase
        .from("afroloc_records")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["approved", "pending"])
        .order("is_primary_residence", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setRecord(rec);

      if (rec) {
        const [witRes, valRes] = await Promise.all([
          supabase.from("afroloc_witnesses").select("*").eq("afroloc_record_id", rec.id),
          supabase.from("afroloc_validations").select("*").eq("afroloc_record_id", rec.id),
        ]);
        setWitnesses(witRes.data || []);
        setValidations(valRes.data || []);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    if (qrOpen && record) {
      QRCodeLib.toDataURL(record.code, {
        width: 400,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      }).then(setQrCodeUrl).catch(console.error);
    }
  }, [qrOpen, record]);

  const handleCopy = async () => {
    if (!record) return;
    try {
      await navigator.clipboard.writeText(record.code);
      toast({ title: t("copied") || "Copiado!", description: record.code });
    } catch {
      toast({ title: t("error"), description: "Falha ao copiar", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    if (!record) return;
    const text = `Meu endereço AFROLOC: ${record.code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Meu AfroLoc", text });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: t("copied") || "Copiado!", description: "Código copiado para partilhar" });
    }
  };

  const getLabel = () => {
    const parts = [
      record?.level1_name,
      record?.level2_name,
      record?.level3_name,
      record?.level4_name,
    ].filter(Boolean);
    if (record?.street_name) parts.push(record.street_name);
    if (record?.number) parts.push(`nº ${record.number}`);
    return parts.join(", ");
  };

  // Trust indicators
  const confirmedWitnesses = witnesses.filter(w => w.status === "confirmed").length;
  const hasGpsValidation = !!record?.gps_validated_at;
  const hasOfficialValidation = validations.some(v => v.verified_at);
  const isApproved = record?.status === "approved";
  const isTemporary = record?.is_temporary === true;
  const daysRemaining = getTemporaryDaysRemaining(record?.temporary_expires_at ?? null);
  const isExpired = isTemporary && daysRemaining !== null && daysRemaining <= 0;

  const trustChecks = record ? [
    { label: "Endereço aprovado", ok: isApproved && !isTemporary, icon: CheckCircle2 },
    { label: "Coordenadas GPS", ok: !!(record.geo_lat && record.geo_lon), icon: Navigation },
    { label: "Validação GPS", ok: hasGpsValidation, icon: Navigation },
    { label: `Testemunhas confirmadas (${confirmedWitnesses})`, ok: confirmedWitnesses >= 2, icon: Users },
    { label: "Validação oficial", ok: hasOfficialValidation, icon: FileCheck },
  ] : [];

  const trustScore = trustChecks.filter(c => c.ok).length;
  const trustTotal = trustChecks.length;

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto py-6 space-y-6">
        <h1 className="text-2xl font-bold">Meu AfroLoc</h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !record ? (
          <Card>
            <CardContent className="py-12 text-center space-y-2">
              <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">
                Ainda não tens um endereço AfroLoc aprovado.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Temporary badge banner */}
            {isTemporary && (
              <Card className={isExpired ? "border-destructive/50 bg-destructive/5" : "border-amber-400/50 bg-amber-500/5"}>
                <CardContent className="py-3 flex items-center gap-3">
                  <Timer className={`h-5 w-5 shrink-0 ${isExpired ? "text-destructive" : "text-amber-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${isExpired ? "text-destructive" : "text-amber-600"}`}>
                      {isExpired ? "Código temporário expirado" : "Código temporário"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isExpired
                        ? "Contacta o teu gestor de endereços para reativação."
                        : `Válido por mais ${daysRemaining} dia${daysRemaining !== 1 ? "s" : ""}. Completa a verificação para torná-lo permanente.`}
                    </p>
                  </div>
                  <Badge variant={isExpired ? "destructive" : "outline"} className={!isExpired ? "border-amber-400 text-amber-600" : ""}>
                    {isExpired ? "EXPIRADO" : "TEMP"}
                  </Badge>
                </CardContent>
              </Card>
            )}

            {/* Code display */}
            <Card className={isTemporary ? (isExpired ? "border-destructive/30 opacity-60" : "border-amber-400/30") : "border-primary/30"}>
              <CardContent className="py-8 text-center space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                    Código AfroLoc
                  </p>
                  {isTemporary && (
                    <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600">
                      <Clock className="h-2.5 w-2.5 mr-0.5" />
                      TEMP
                    </Badge>
                  )}
                  <ATSScoreBadge
                    atsScore={record.ats_score}
                    certificationLevel={record.certification_level}
                    breakdown={record.ats_breakdown}
                    size="sm"
                  />
                </div>
                <p className="text-3xl sm:text-4xl font-mono font-bold tracking-wide select-all text-foreground break-all">
                  {record.code}
                </p>

                {/* Validity info for temp */}
                {isTemporary && !isExpired && record.temporary_expires_at && (
                  <p className="text-xs text-amber-600">
                    Válido até {new Date(record.temporary_expires_at).toLocaleDateString("pt")}
                    {record.temporary_validity_days && ` (${record.temporary_validity_days} dias)`}
                  </p>
                )}

                {/* Label & tile */}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {getLabel()}
                  </p>
                  {(record as any).property_name && (
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-sm italic text-muted-foreground">
                        {(record as any).property_name}
                      </span>
                      <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600">
                        <AlertCircle className="h-2.5 w-2.5 mr-0.5" /> Não verificado
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Trust & compliance checklist */}
            <Card>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Fiabilidade do endereço</span>
                  </div>
                  <Badge variant={trustScore === trustTotal ? "default" : "outline"} className="text-xs">
                    {trustScore}/{trustTotal}
                  </Badge>
                </div>
                <Separator />
                <div className="space-y-2">
                  {trustChecks.map((check, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {check.ok ? (
                        <CheckCircle2 className="h-4 w-4 text-chart-2 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      )}
                      <span className={check.ok ? "text-foreground" : "text-muted-foreground"}>
                        {check.label}
                      </span>
                    </div>
                  ))}
                </div>
                {trustScore < trustTotal && (
                  <p className="text-xs text-muted-foreground pt-1">
                    {isTemporary
                      ? "Completa todas as verificações para converter o teu código temporário em permanente."
                      : "Completa todas as verificações para aumentar a fiabilidade do teu endereço junto de apps parceiras."}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-3">
              <Button variant="outline" className="flex-col h-auto py-4 gap-2" onClick={handleCopy} disabled={isExpired}>
                <Copy className="h-5 w-5" />
                <span className="text-xs">Copiar</span>
              </Button>
              <Button variant="outline" className="flex-col h-auto py-4 gap-2" onClick={() => setQrOpen(true)} disabled={isExpired}>
                <QrCode className="h-5 w-5" />
                <span className="text-xs">QR Code</span>
              </Button>
              <Button variant="outline" className="flex-col h-auto py-4 gap-2" onClick={handleShare} disabled={isExpired}>
                <Share2 className="h-5 w-5" />
                <span className="text-xs">Partilhar</span>
              </Button>
            </div>

            {/* Help text */}
            <p className="text-sm text-muted-foreground text-center px-4">
              Usa este código para registar o teu endereço em apps parceiras como o Yamioo.
            </p>

            {/* QR Dialog */}
            <Dialog open={qrOpen} onOpenChange={setQrOpen}>
              <DialogContent className="sm:max-w-xs">
                <DialogHeader>
                  <DialogTitle className="text-center">QR Code</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-white rounded-lg p-4">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="QR Code" className="w-56 h-56" />
                    ) : (
                      <div className="w-56 h-56 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    )}
                  </div>
                  <p className="font-mono text-sm font-bold text-center break-all">{record.code}</p>
                  {isTemporary && (
                    <Badge variant="outline" className="border-amber-400 text-amber-600">
                      <Clock className="h-3 w-3 mr-1" /> Temporário
                    </Badge>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}