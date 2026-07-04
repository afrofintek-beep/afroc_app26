import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, Copy, Download, RefreshCw, ArrowLeft, AlertTriangle, Check } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import afrolocSymbol from "@/assets/afroloc-symbol.png";

export default function AdminBackupCodes() {
  const [codes, setCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [existingCodesCount, setExistingCodesCount] = useState<number>(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    checkExistingCodes();
  }, []);

  const checkExistingCodes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count } = await supabase
        .from("two_factor_backup_codes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("used", false);

      setExistingCodesCount(count || 0);
    } catch (error) {
      console.error("Error checking existing codes:", error);
    }
  };

  const generateCodes = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("generate-backup-codes");

      if (error) throw error;

      if (data.success) {
        setCodes(data.codes);
        setExistingCodesCount(data.codes.length);
        toast({
          title: t('backupcodes_toast_generated_title'),
          description: t('backupcodes_toast_generated_desc'),
        });
      } else {
        throw new Error(data.error || t('backupcodes_error_generate_failed'));
      }
    } catch (error: any) {
      toast({
        title: t('backupcodes_toast_generation_failed_title'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast({
      title: t('backupcodes_toast_copied_title'),
      description: t('backupcodes_toast_copied_desc'),
    });
  };

  const copyAllCodes = () => {
    const allCodes = codes.join("\n");
    navigator.clipboard.writeText(allCodes);
    toast({
      title: t('backupcodes_toast_all_copied_title'),
      description: t('backupcodes_toast_all_copied_desc'),
    });
  };

  const downloadCodes = () => {
    const content = `${t('backupcodes_file_heading')}\n${t('backupcodes_file_generated_label')}: ${new Date().toLocaleString()}\n\n${codes.join("\n")}\n\n${t('backupcodes_file_important')}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `afro-id-backup-codes-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: t('backupcodes_toast_downloaded_title'),
      description: t('backupcodes_toast_downloaded_desc'),
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/10 to-muted/30 p-4">
      <div className="absolute top-4 left-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/import-divisions")}
          title={t('backupcodes_back_to_dashboard')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>

      <Card className="w-full max-w-2xl border-primary/20 shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <img src={afrolocSymbol} alt="AFROLOC" className="h-14 w-14 object-cover rounded-xl shadow-md ring-1 ring-primary/20" />
              <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1.5">
                <Shield className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{t('backupcodes_title')}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {t('backupcodes_description')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {existingCodesCount > 0 && codes.length === 0 && (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-md p-4">
              <p className="text-sm text-green-800 dark:text-green-200">
                <Check className="h-4 w-4 inline mr-2" />
                {t('backupcodes_have_prefix')} {existingCodesCount} {existingCodesCount !== 1 ? t('backupcodes_unused_codes_plural') : t('backupcodes_unused_codes_singular')} {t('backupcodes_available_suffix')}
              </p>
            </div>
          )}

          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200 space-y-2">
                <p className="font-semibold">{t('backupcodes_security_info_title')}</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>{t('backupcodes_security_item_once')}</li>
                  <li>{t('backupcodes_security_item_store')}</li>
                  <li>{t('backupcodes_security_item_invalidate')}</li>
                  <li>{t('backupcodes_security_item_never_share')}</li>
                  <li>{t('backupcodes_security_item_primary_method')}</li>
                </ul>
              </div>
            </div>
          </div>

          {codes.length === 0 ? (
            <div className="text-center py-8">
              <Button
                onClick={generateCodes}
                disabled={loading}
                size="lg"
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? t('backupcodes_btn_generating') : existingCodesCount > 0 ? t('backupcodes_btn_regenerate') : t('backupcodes_btn_generate')}
              </Button>
              {existingCodesCount > 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  {t('backupcodes_invalidate_prefix')} {existingCodesCount} {existingCodesCount !== 1 ? t('backupcodes_unused_codes_plural') : t('backupcodes_unused_codes_singular')}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={copyAllCodes}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {t('backupcodes_btn_copy_all')}
                </Button>
                <Button
                  onClick={downloadCodes}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t('backupcodes_btn_download')}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {codes.map((code, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-muted/50 border border-border rounded-md p-3 group hover:bg-muted transition-colors"
                  >
                    <code className="text-sm font-mono font-semibold">
                      {code}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => copyCode(code, index)}
                    >
                      {copiedIndex === index ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>

              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4 text-center">
                <p className="text-sm text-destructive font-semibold mb-2">
                  ⚠️ {t('backupcodes_save_now')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('backupcodes_not_shown_again')}
                </p>
              </div>

              <Button
                onClick={generateCodes}
                variant="outline"
                className="w-full"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {t('backupcodes_btn_generate_new')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
