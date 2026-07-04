import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import TranslationImporter from "@/components/TranslationImporter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, AlertCircle, CheckCircle, RefreshCw, Languages, BarChart3, FileDown } from "lucide-react";
import { toast } from "sonner";
import {
  validateTranslations,
  groupMissingByLanguage,
  exportReportToJSON,
  exportTranslationsToExcel,
  printValidationReport,
  type ValidationReport,
  type Language,
  type MissingTranslation,
  type LanguageStats,
} from "@/utils/translationValidator";
import { downloadSyncedTranslations } from "@/utils/syncTranslations";
import { useLanguage } from '@/contexts/LanguageContext';

export default function TranslationValidationPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [report, setReport] = useState<ValidationReport>(() => validateTranslations());

  const handleRefresh = () => {
    const newReport = validateTranslations();
    setReport(newReport);
    printValidationReport(newReport);
  };

  const handleDownloadReport = () => {
    const json = exportReportToJSON(report);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translation-report-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadManual = async () => {
    await exportTranslationsToExcel();
  };

  const handleDownloadSynced = async () => {
    toast.info(t('transval_downloading_synced'));
    await downloadSyncedTranslations();
    toast.success(t('transval_synced_downloaded'));
  };

  const getCompletionBadge = (rate: number) => {
    if (rate === 100) return <Badge variant="default" className="bg-green-600">{t('transval_status_complete')}</Badge>;
    if (rate >= 90) return <Badge variant="secondary" className="bg-yellow-600">{t('transval_status_good')}</Badge>;
    if (rate >= 70) return <Badge variant="outline" className="text-orange-500 border-orange-500">{t('transval_status_partial')}</Badge>;
    return <Badge variant="destructive">{t('transval_status_incomplete')}</Badge>;
  };

  const getProgressColor = (rate: number) => {
    if (rate === 100) return "bg-green-500";
    if (rate >= 90) return "bg-yellow-500";
    if (rate >= 70) return "bg-orange-500";
    return "bg-red-500";
  };

  const groupedMissing = groupMissingByLanguage(report.missingTranslations);

  // Calculate overall stats
  const avgCompletion = Math.round(
    report.languageStats.reduce((sum, lang) => sum + lang.completionRate, 0) / report.languageStats.length
  );
  const completeLanguages = report.languageStats.filter(l => l.completionRate === 100).length;
  const partialLanguages = report.languageStats.filter(l => l.completionRate >= 70 && l.completionRate < 100).length;
  const incompleteLanguages = report.languageStats.filter(l => l.completionRate < 70).length;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="flex-shrink-0 mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Languages className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-bold">{t('transval_page_title')}</h1>
            </div>
            <p className="text-muted-foreground">
              {report.totalKeys} {t('transval_total_keys_across')} {report.languages.length} {t('transval_languages_baseline')}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('transval_refresh')}
            </Button>
            <Button variant="default" size="sm" onClick={handleDownloadSynced}>
              <FileDown className="h-4 w-4 mr-2" />
              {t('transval_download_synced_files')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadManual}>
              <Download className="h-4 w-4 mr-2" />
              {t('transval_export_excel')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadReport}>
              <Download className="h-4 w-4 mr-2" />
              {t('transval_export_json')}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('transval_total_keys')}</CardDescription>
              <CardTitle className="text-3xl">{report.totalKeys}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('transval_languages')}</CardDescription>
              <CardTitle className="text-3xl">{report.languages.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('transval_avg_completion')}</CardDescription>
              <CardTitle className="text-3xl">{avgCompletion}%</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('transval_complete')}</CardDescription>
              <CardTitle className="text-3xl text-green-500">{completeLanguages}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('transval_missing_keys')}</CardDescription>
              <CardTitle className="text-3xl text-amber-500">{report.missingTranslations.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Import Section */}
        <TranslationImporter />

        {/* Main Content */}
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="table">
              <TabsList className="mb-6">
                <TabsTrigger value="table">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  {t('transval_completion_table')}
                </TabsTrigger>
                <TabsTrigger value="overview">{t('transval_overview')}</TabsTrigger>
                <TabsTrigger value="missing">
                  {t('transval_missing_keys')}
                  {!report.isValid && (
                    <Badge variant="destructive" className="ml-2">
                      {report.missingTranslations.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="table">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">{t('transval_lang_completion_summary')}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('transval_col_language')}</TableHead>
                        <TableHead>{t('transval_col_code')}</TableHead>
                        <TableHead className="text-right">{t('transval_col_present_keys')}</TableHead>
                        <TableHead className="text-right">{t('transval_missing_keys')}</TableHead>
                        <TableHead className="text-right">{t('transval_col_completion')}</TableHead>
                        <TableHead className="w-[200px]">{t('transval_col_progress')}</TableHead>
                        <TableHead>{t('transval_col_status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.languageStats.map((lang: LanguageStats) => (
                        <TableRow key={lang.code}>
                          <TableCell className="font-medium">{lang.name}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{lang.code}.json</code>
                          </TableCell>
                          <TableCell className="text-right font-mono">{lang.presentKeys}</TableCell>
                          <TableCell className="text-right font-mono">
                            {lang.missingKeys > 0 ? (
                              <span className="text-amber-500">{lang.missingKeys}</span>
                            ) : (
                              <span className="text-green-500">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {lang.completionRate}%
                          </TableCell>
                          <TableCell>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${getProgressColor(lang.completionRate)}`}
                                style={{ width: `${lang.completionRate}%` }}
                              />
                            </div>
                          </TableCell>
                          <TableCell>{getCompletionBadge(lang.completionRate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="overview">
                <div className="space-y-6">
                  {/* Overall Status */}
                  <div className="p-4 rounded-lg bg-muted">
                    {report.isValid ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span className="font-medium">{t('transval_all_complete')}</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-yellow-500" />
                          <span className="font-medium">
                            {t('transval_found')} {report.missingTranslations.length} {t('transval_missing_across')} {Object.keys(groupedMissing).length} {t('transval_languages')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t('transval_review_details')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Completion Rates Cards */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">{t('transval_lang_completion_rates')}</h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {report.languageStats.map((lang: LanguageStats) => (
                        <Card key={lang.code}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">{lang.name}</CardTitle>
                              {getCompletionBadge(lang.completionRate)}
                            </div>
                            <CardDescription>
                              {lang.presentKeys} / {lang.totalKeys} {t('transval_keys')} •
                              {lang.missingKeys > 0 ? ` ${lang.missingKeys} ${t('transval_missing_lower')}` : ` ${t('transval_all_present')}`}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{t('transval_col_progress')}</span>
                                <span className="font-semibold">{lang.completionRate}%</span>
                              </div>
                              <Progress value={lang.completionRate} className="h-2" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="missing">
                {report.isValid ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">{t('transval_all_translations_complete')}</h3>
                    <p className="text-muted-foreground">
                      {t('transval_every_language_has_keys')}
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-6">
                      {Object.entries(groupedMissing).map(([language, missing]) => (
                        <Card key={language}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg uppercase">{language}</CardTitle>
                              <Badge variant="outline">{missing.length} {t('transval_missing_lower')}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {missing.map((m: MissingTranslation, index: number) => (
                                <div
                                  key={`${m.language}-${m.key}-${index}`}
                                  className="p-3 rounded-lg bg-muted"
                                >
                                  <code className="font-mono text-sm font-semibold">{m.key}</code>
                                  {m.referenceValue && (
                                    <p className="text-muted-foreground mt-2 text-sm">
                                      <span className="font-medium">{t('transval_english_label')}</span> {m.referenceValue}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
