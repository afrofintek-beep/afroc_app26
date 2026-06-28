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
          title: "Testemunha Inválida",
          description: "Este AFROLOC não existe. A testemunha deve ter um AFROLOC verificado para participar.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (witnessRecord.status !== "verified" && witnessRecord.status !== "certified") {
        toast({
          title: "AFROLOC Não Ativo",
          description: "Este AFROLOC não está ativo. A testemunha deve ter um AFROLOC verificado ou certificado.",
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
          title: "Morada Não Validada",
          description: "Esta testemunha não possui morada validada. É necessário ter validação de autoridade ou de testemunhas aprovada.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Check if user is trying to add themselves as witness
      if (witnessRecord.user_id === user.id) {
        toast({
          title: "Erro de Validação",
          description: "Você não pode adicionar-se como testemunha.",
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
          title: "Testemunha Duplicada",
          description: "Esta testemunha já foi adicionada anteriormente",
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
          title: "Aviso",
          description: "Testemunha adicionada mas a notificação não pôde ser enviada.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sucesso",
          description: "Testemunha adicionada com sucesso. Receberá uma solicitação de confirmação via SMS.",
        });
      }
      
      navigate(`/identity/${id}`);
    } catch (error: any) {
      toast({
        title: "Error",
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
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground break-words">Adicionar Testemunha</h1>
            <p className="text-muted-foreground text-sm sm:text-base break-words">Convide um vizinho para confirmar sua morada</p>
          </div>
        </div>

        <Alert className="border-primary/50 bg-primary/5">
          <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
          <AlertDescription className="text-xs sm:text-sm break-words">
            <strong>Processo de Validação por Testemunhas:</strong> O validador regional enviará um SMS para a testemunha com as opções: 
            <span className="font-mono mx-1">1) SIM</span> ou <span className="font-mono mx-1">2) NÃO</span>. 
            A testemunha deve responder confirmando ou negando que você reside nesta morada.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl">Informação da Testemunha</CardTitle>
            <CardDescription className="text-xs sm:text-sm break-words">
              Insira o AFROLOC de um vizinho que possa confirmar sua residência. 
              <strong className="text-foreground"> A testemunha deve ter AFROLOC ativo e morada validada.</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <Label htmlFor="witness_afro_id" className="text-sm sm:text-base">
                  AFROLOC da Testemunha <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="witness_afro_id"
                  value={witnessAfroId}
                  onChange={(e) => {
                    setWitnessAfroId(e.target.value.toUpperCase());
                    setErrors({});
                  }}
                  placeholder="ex: AO-TAL-TAL-VID-G10-2ZP1-N1FTR"
                  className={`text-sm sm:text-base ${errors.witness_afro_id ? "border-destructive" : ""}`}
                  maxLength={100}
                />
                {errors.witness_afro_id && (
                  <p className="text-xs sm:text-sm text-destructive break-words">{errors.witness_afro_id}</p>
                )}
                <p className="text-xs sm:text-sm text-muted-foreground break-words">
                  Formato: AO-PROV-MUN-COM-G10-XXXX-NXXXX
                </p>
              </div>

              <Alert className="border-amber-500/50 bg-amber-500/5">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 flex-shrink-0" />
                <AlertDescription>
                  <h3 className="font-semibold mb-2 text-foreground text-sm sm:text-base">Requisitos Obrigatórios para Testemunhas:</h3>
                  <ul className="space-y-2 text-xs sm:text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="break-words"><strong>AFROLOC Ativo:</strong> Deve ter AFROLOC verificado ou certificado</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="break-words"><strong>Morada Validada:</strong> A testemunha deve ter sua própria morada validada por autoridade ou outras testemunhas</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="break-words"><strong>Proximidade:</strong> Deve residir dentro de 100 metros da sua localização</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="break-words"><strong>SMS de Confirmação:</strong> Receberá SMS do validador regional com opções SIM/NÃO</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="break-words"><strong>Mínimo de Testemunhas:</strong> Você precisa de 3 testemunhas confirmadas para validação</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-destructive mt-0.5 flex-shrink-0" />
                      <span className="break-words"><strong>Restrição:</strong> Você não pode adicionar-se como testemunha</span>
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
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="flex-1 text-sm sm:text-base">
                  <UserPlus className="mr-2 h-4 w-4" />
                  {loading ? "Adicionando..." : "Adicionar Testemunha"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
