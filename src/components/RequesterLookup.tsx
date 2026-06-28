import { useState } from "react";
import { Search, User, Phone, Mail, CreditCard, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export interface RequesterProfile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  afro_id: string | null;
  country: string | null;
  city: string | null;
  document_type: string | null;
  document_number: string | null;
}

interface RequesterLookupProps {
  onSelect: (profile: RequesterProfile) => void;
  selectedProfile: RequesterProfile | null;
  onClear: () => void;
}

export default function RequesterLookup({ onSelect, selectedProfile, onClear }: RequesterLookupProps) {
  const [phone, setPhone] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<RequesterProfile[]>([]);
  const [searched, setSearched] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!phone.trim() || phone.trim().length < 6) {
      toast({ title: "Número inválido", description: "Insira pelo menos 6 dígitos.", variant: "destructive" });
      return;
    }

    setSearching(true);
    setSearched(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const resp = await supabase.functions.invoke("lookup-requester", {
        body: { phone: phone.trim() },
      });

      if (resp.error) {
        toast({ title: "Erro na pesquisa", description: resp.error.message, variant: "destructive" });
        setResults([]);
        return;
      }

      const data = resp.data as { found: boolean; results: RequesterProfile[] };
      setResults(data.results || []);

      if (!data.found || data.results.length === 0) {
        toast({ title: "Não encontrado", description: "Nenhum utilizador registado com este número.", variant: "destructive" });
      }
    } catch (err) {
      console.error("Lookup error:", err);
      toast({ title: "Erro", description: "Falha na pesquisa do solicitante.", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const documentTypeLabel = (type: string | null) => {
    switch (type) {
      case "bi": return "Bilhete de Identidade";
      case "passport": return "Passaporte";
      case "driving_license": return "Carta de Condução";
      default: return type || "—";
    }
  };

  // Selected profile card
  if (selectedProfile) {
    return (
      <Card className="border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Solicitante Identificado
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
              <XCircle className="h-4 w-4 mr-1" />
              Alterar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ProfileField icon={<User className="h-4 w-4" />} label="Nome" value={selectedProfile.full_name} highlight />
            <ProfileField icon={<Phone className="h-4 w-4" />} label="Telefone" value={selectedProfile.phone} highlight />
            <ProfileField icon={<Mail className="h-4 w-4" />} label="Email" value={selectedProfile.email} highlight />
            <ProfileField icon={<CreditCard className="h-4 w-4" />} label="BI / Documento" value={
              selectedProfile.document_number
                ? `${documentTypeLabel(selectedProfile.document_type)}: ${selectedProfile.document_number}`
                : null
            } highlight />
          </div>
          {selectedProfile.afro_id && (
            <div className="mt-2">
              <Badge variant="outline" className="font-mono text-xs">AFRO-ID: {selectedProfile.afro_id}</Badge>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="h-5 w-5 text-amber-500" />
          Identificar Solicitante
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Pesquise o número de telefone do solicitante registado no Yamioo
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="+244 9XX XXX XXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="font-mono"
          />
          <Button onClick={handleSearch} disabled={searching || phone.trim().length < 6}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {/* Results */}
        {searched && results.length > 0 && (
          <div className="space-y-2">
            <Separator />
            <p className="text-xs text-muted-foreground">{results.length} resultado(s) encontrado(s)</p>
            {results.map((r) => (
              <button
                key={r.user_id}
                onClick={() => onSelect(r)}
                className="w-full text-left p-3 rounded-lg border hover:border-primary hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-sm">{r.full_name || "Sem nome"}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone || "—"}</span>
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{r.email || "—"}</span>
                      {r.document_number && (
                        <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" />{r.document_number}</span>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">Selecionar</Badge>
                </div>
              </button>
            ))}
          </div>
        )}

        {searched && results.length === 0 && !searching && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Nenhum utilizador encontrado com este número.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileField({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string | null; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-sm ${highlight && value ? "font-semibold" : "text-muted-foreground"}`}>
          {value || "—"}
        </p>
      </div>
    </div>
  );
}
