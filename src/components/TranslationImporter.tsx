import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, Download, AlertCircle, CheckCircle, FileText, Archive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  importTranslationsFromExcel,
  generateTranslationFiles,
  type ImportValidationResult,
} from "@/utils/translationValidator";

export default function TranslationImporter() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportValidationResult | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const result = await importTranslationsFromExcel(file);
      setImportResult(result);

      if (result.isValid) {
        toast({
          title: t('transimport_toast_validated_title'),
          description: `${result.stats.totalKeys} ${t('transimport_toast_validated_desc')}`,
        });
      } else {
        toast({
          title: t('transimport_toast_import_error_title'),
          description: result.errors[0] || t('transimport_toast_unknown_error'),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t('transimport_toast_error_title'),
        description: t('transimport_toast_process_error'),
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadFiles = () => {
    if (!importResult?.translations) return;

    const files = generateTranslationFiles(importResult.translations);
    
    Object.entries(files).forEach(([lang, content]) => {
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${lang}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    toast({
      title: t('transimport_toast_files_generated_title'),
      description: `${Object.keys(files).length} ${t('transimport_toast_files_generated_desc')}`,
    });
  };

  const completionRate = importResult?.stats.totalKeys 
    ? Math.round((importResult.stats.updatedKeys / importResult.stats.totalKeys) * 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          {t('transimport_title')}
        </CardTitle>
        <CardDescription>
          {t('transimport_description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={importing}
            >
              <Upload className="h-4 w-4 mr-2" />
              {importing ? t('transimport_processing') : t('transimport_select_file')}
            </Button>
            <input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {importResult && (
            <div className="space-y-4">
              {/* Status */}
              <Alert variant={importResult.isValid ? "default" : "destructive"}>
                {importResult.isValid ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {importResult.isValid
                    ? t('transimport_validation_success')
                    : t('transimport_validation_errors')}
                </AlertDescription>
              </Alert>

              {/* Errors */}
              {importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-destructive">{t('transimport_errors_label')}</h4>
                  {importResult.errors.map((error, i) => (
                    <p key={i} className="text-sm text-destructive">{error}</p>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {importResult.warnings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-yellow-600">{t('transimport_warnings_label')}</h4>
                  {importResult.warnings.map((warning, i) => (
                    <p key={i} className="text-sm text-yellow-600">{warning}</p>
                  ))}
                </div>
              )}

              {/* Stats */}
              {importResult.isValid && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t('transimport_stat_total_keys')}</p>
                      <p className="text-2xl font-bold">{importResult.stats.totalKeys}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t('transimport_stat_updated')}</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {importResult.stats.updatedKeys}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t('transimport_stat_new')}</p>
                      <p className="text-2xl font-bold text-green-600">
                        {importResult.stats.newKeys}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t('transimport_stat_languages')}</p>
                      <p className="text-2xl font-bold">{importResult.stats.languages.length}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t('transimport_update_rate')}</span>
                      <span className="text-sm font-medium">{completionRate}%</span>
                    </div>
                    <Progress value={completionRate} className="h-2" />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {importResult.stats.languages.map((lang) => (
                      <Badge key={lang} variant="secondary">
                        {lang.toUpperCase()}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleDownloadFiles} className="flex-1">
                      <Archive className="h-4 w-4 mr-2" />
                      {t('transimport_download_button')}
                    </Button>
                  </div>

                  <Alert>
                    <FileText className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{t('transimport_next_steps_label')}</strong> {t('transimport_next_steps_before')}<code>src/translations/</code>{t('transimport_next_steps_after')}
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
