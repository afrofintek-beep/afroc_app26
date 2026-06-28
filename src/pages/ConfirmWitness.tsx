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
        title: "Success",
        description: "Testemunho confirmado com sucesso!",
      });

      setTimeout(() => {
        navigate("/identities");
      }, 3000);
    } catch (error: any) {
      console.error("Verification error:", error);
      toast({
        title: "Erro",
        description: error.message || "Código OTP inválido ou expirado",
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
            <CardTitle className="text-2xl">Testemunho Confirmado!</CardTitle>
            <CardDescription>
              Obrigado por confirmar o endereço do seu vizinho
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Sua confirmação ajuda a criar um sistema de endereçamento digital confiável para África.
            </p>
            <Button onClick={() => navigate("/identities")} className="w-full">
              Ir para Meus AFROLOCs
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
          <CardTitle className="text-xl sm:text-2xl">Confirmar Testemunho</CardTitle>
          <CardDescription className="text-sm">
            Insira o código OTP enviado para o seu email
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
            {/* Legal Contract Section */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                <h3 className="font-semibold text-sm sm:text-base">Contrato Legal de Testemunho</h3>
              </div>
              
              <ScrollArea className="h-40 sm:h-48 rounded-md border border-border p-3 sm:p-4 bg-muted/30">
                <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-foreground/90 pr-2 sm:pr-4">
                  <p className="font-semibold">TERMO DE COMPROMISSO DE TESTEMUNHA</p>
                  
                  <p>
                    Eu, abaixo assinado, declaro para os devidos fins que:
                  </p>
                  
                  <ol className="list-decimal list-inside space-y-2 ml-2">
                    <li>Conheço pessoalmente o residente cujo endereço estou atestando;</li>
                    <li>Confirmo que as informações de localização fornecidas são verdadeiras e corretas;</li>
                    <li>Estou ciente de que este testemunho será usado para validação oficial de endereço no sistema AFROLOC;</li>
                    <li>Compreendo que fornecer informações falsas pode resultar em consequências legais;</li>
                    <li>Autorizo o uso desta declaração para fins de verificação de identidade e endereço;</li>
                    <li>Assumo total responsabilidade pela veracidade das informações prestadas.</li>
                  </ol>
                  
                  <p className="text-muted-foreground italic">
                    Este termo é regido pelas leis aplicáveis e constitui um compromisso legal de veracidade das informações prestadas.
                  </p>
                </div>
              </ScrollArea>
            </div>

            {/* Full Name Field */}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm">
                Nome Completo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setErrors({});
                }}
                placeholder="Digite seu nome completo"
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
                  Li e concordo com os termos do contrato acima <span className="text-destructive">*</span>
                </Label>
                {errors.agreeToTerms && (
                  <p className="text-xs sm:text-sm text-destructive break-words">{errors.agreeToTerms}</p>
                )}
              </div>
            </div>

            {/* Signature Field */}
            <div className="space-y-2">
              <Label htmlFor="signature" className="text-sm">
                Assinatura Digital <span className="text-destructive">*</span>
              </Label>
              <Input
                id="signature"
                type="text"
                value={signature}
                onChange={(e) => {
                  setSignature(e.target.value);
                  setErrors({});
                }}
                placeholder="Digite seu nome completo como assinatura"
                className={`italic text-sm sm:text-base ${errors.signature ? "border-destructive" : ""}`}
              />
              {errors.signature && (
                <p className="text-xs sm:text-sm text-destructive break-words">{errors.signature}</p>
              )}
              <p className="text-xs text-muted-foreground break-words">
                Ao digitar seu nome, você está assinando digitalmente este contrato
              </p>
            </div>

            {/* OTP Field */}
            <div className="space-y-2">
              <Label htmlFor="otp" className="text-sm">
                Código OTP <span className="text-destructive">*</span>
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
                Digite o código de 6 dígitos que recebeu por email
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/50 p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm flex-1 min-w-0">
                  <p className="font-semibold mb-1">Responsabilidade do Testemunho</p>
                  <p className="text-muted-foreground break-words">
                    Ao confirmar, você atesta que conhece pessoalmente o residente e que o endereço está correto.
                  </p>
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={loading || otp.length !== 6 || !agreeToTerms || !fullName || !signature} 
              className="w-full text-sm sm:text-base mt-4"
            >
              {loading ? "Verificando..." : "Assinar e Confirmar Testemunho"}
            </Button>

            <p className="text-center text-xs sm:text-sm text-muted-foreground">
              Não recebeu o código?{" "}
              <button
                type="button"
                className="text-primary hover:underline font-medium"
                onClick={() => {
                  toast({
                    title: "Reenviando OTP",
                    description: "Um novo código será enviado em breve",
                  });
                }}
              >
                Reenviar
              </button>
            </p>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
