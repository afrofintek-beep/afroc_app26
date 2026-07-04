import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Copy, Check, Package, ShieldCheck, Lock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t } = useLanguage();
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
        if (!res.ok) throw new Error(t('sourcedl_error_load_manifest'));
        setManifest(await res.json());
      } catch (e: any) {
        setError(e?.message ?? t('sourcedl_error_access_denied'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const copySha = async () => {
    if (!manifest) return;
    await navigator.clipboard.writeText(manifest.sha256);
    setCopied(true);
    toast({ title: t('sourcedl_toast_checksum_copied') });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async (kind: "zip" | "manifest") => {
    setBusy(kind);
    try {
      const url = await requestSignedUrl(kind);
      window.location.href = url;
    } catch (e: any) {
      toast({
        title: t('sourcedl_toast_error'),
        description: e?.message ?? t('sourcedl_toast_link_failed'),
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
            {t('sourcedl_title')}
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {t('sourcedl_subtitle')}
          </p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              {t('sourcedl_checking_permissions')}
            </CardContent>
          </Card>
        ) : error || !manifest ? (
          <Card>
            <CardContent className="py-10 text-center text-destructive">
              {error ?? t('sourcedl_access_denied')}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t('sourcedl_package')} {manifest.version}</CardTitle>
              <CardDescription>
                {t('sourcedl_generated_at')} {new Date(manifest.generated_at).toLocaleString("pt-PT")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">{t('sourcedl_file')}</div>
                  <div className="font-mono break-all">{manifest.filename}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t('sourcedl_size')}</div>
                  <div className="font-mono">{formatBytes(manifest.size_bytes)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t('sourcedl_version')}</div>
                  <div className="font-mono">{manifest.version}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t('sourcedl_algorithm')}</div>
                  <div className="font-mono">SHA-256</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4" /> {t('sourcedl_checksum_label')}
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-muted rounded text-xs break-all font-mono">
                    {manifest.sha256}
                  </code>
                  <Button variant="outline" size="icon" onClick={copySha} aria-label={t('sourcedl_copy_checksum_aria')}>
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
                  {busy === "zip" ? t('sourcedl_generating_link') : t('sourcedl_download_zip')}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleDownload("manifest")}
                  disabled={busy !== null}
                >
                  {busy === "manifest" ? t('sourcedl_generating') : t('sourcedl_manifest_json')}
                </Button>
              </div>

              <div className="text-xs text-muted-foreground border-t pt-4 space-y-2">
                <p className="font-semibold text-foreground">{t('sourcedl_verify_integrity')}</p>
                <pre className="bg-muted p-2 rounded overflow-x-auto">
{`# Linux / macOS
sha256sum ${manifest.filename}

# Windows (PowerShell)
Get-FileHash ${manifest.filename} -Algorithm SHA256`}
                </pre>
                <p>{t('sourcedl_verify_note')}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SourceDownload;
