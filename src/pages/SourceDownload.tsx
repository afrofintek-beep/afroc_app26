import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Copy, Check, Package, ShieldCheck, Lock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Manifest {
  version: string;
  filename: string;
  sha256: string;
  size_bytes: number;
  generated_at: string;
}

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(2)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
};

const requestSignedUrl = async (kind: "zip" | "manifest") => {
  const { data, error } = await supabase.functions.invoke("download-source", {
    body: { kind },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("No URL returned");
  return data.url as string;
};

const SourceDownload = () => {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"zip" | "manifest" | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const url = await requestSignedUrl("manifest");
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("Falha ao carregar manifesto");
        setManifest(await res.json());
      } catch (e: any) {
        setError(e?.message ?? "Acesso negado");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const copySha = async () => {
    if (!manifest) return;
    await navigator.clipboard.writeText(manifest.sha256);
    setCopied(true);
    toast({ title: "Checksum copiado" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async (kind: "zip" | "manifest") => {
    setBusy(kind);
    try {
      const url = await requestSignedUrl(kind);
      window.location.href = url;
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e?.message ?? "Não foi possível gerar o link.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Package className="h-7 w-7 text-primary" />
            Código-fonte completo
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Acesso restrito a administradores. Os links expiram em 60 segundos.
          </p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              A verificar permissões...
            </CardContent>
          </Card>
        ) : error || !manifest ? (
          <Card>
            <CardContent className="py-10 text-center text-destructive">
              {error ?? "Acesso negado."}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Pacote {manifest.version}</CardTitle>
              <CardDescription>
                Gerado em {new Date(manifest.generated_at).toLocaleString("pt-PT")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Ficheiro</div>
                  <div className="font-mono break-all">{manifest.filename}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Tamanho</div>
                  <div className="font-mono">{formatBytes(manifest.size_bytes)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Versão</div>
                  <div className="font-mono">{manifest.version}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Algoritmo</div>
                  <div className="font-mono">SHA-256</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4" /> Checksum SHA-256
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-muted rounded text-xs break-all font-mono">
                    {manifest.sha256}
                  </code>
                  <Button variant="outline" size="icon" onClick={copySha} aria-label="Copiar checksum">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={() => handleDownload("zip")}
                  disabled={busy !== null}
                >
                  <Download className="h-5 w-5 mr-2" />
                  {busy === "zip" ? "A gerar link..." : "Descarregar ZIP"}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleDownload("manifest")}
                  disabled={busy !== null}
                >
                  {busy === "manifest" ? "A gerar..." : "Manifesto JSON"}
                </Button>
              </div>

              <div className="text-xs text-muted-foreground border-t pt-4 space-y-2">
                <p className="font-semibold text-foreground">Como verificar a integridade:</p>
                <pre className="bg-muted p-2 rounded overflow-x-auto">
{`# Linux / macOS
sha256sum ${manifest.filename}

# Windows (PowerShell)
Get-FileHash ${manifest.filename} -Algorithm SHA256`}
                </pre>
                <p>O valor obtido deve coincidir exatamente com o checksum apresentado acima.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SourceDownload;
