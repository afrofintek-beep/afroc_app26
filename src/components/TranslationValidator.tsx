import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, FileText, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  validateTranslations,
  groupMissingByLanguage,
  exportReportToJSON,
  type ValidationReport,
  type Language,
  type MissingTranslation,
} from "@/utils/translationValidator";

export function TranslationValidator() {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show in development mode
    if (import.meta.env.DEV) {
      const validationReport = validateTranslations();
      setReport(validationReport);
      
      // Show automatically if there are missing translations
      if (!validationReport.isValid) {
        setIsVisible(true);
      }
    }
  }, []);

  const handleDownloadReport = () => {
    if (!report) return;
    
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

  const getCompletionColor = (rate: number): string => {
    if (rate === 100) return "bg-green-500";
    if (rate >= 90) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getCompletionBadge = (rate: number) => {
    if (rate === 100) return <Badge variant="default" className="bg-green-600">Complete</Badge>;
    if (rate >= 90) return <Badge variant="secondary" className="bg-yellow-600">Good</Badge>;
    return <Badge variant="destructive">Incomplete</Badge>;
  };

  if (!report || !import.meta.env.DEV) {
    return null;
  }

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsVisible(true)}
          className="shadow-lg"
        >
          <FileText className="h-4 w-4 mr-2" />
          Translation Status
          {!report.isValid && (
            <Badge variant="destructive" className="ml-2">
              {report.missingTranslations.length}
            </Badge>
          )}
        </Button>
      </div>
    );
  }

  const groupedMissing = groupMissingByLanguage(report.missingTranslations);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {report.isValid ? (
                <CheckCircle className="h-6 w-6 text-green-500" />
              ) : (
                <AlertCircle className="h-6 w-6 text-yellow-500" />
              )}
              <div>
                <CardTitle>Translation Validation Report</CardTitle>
                <CardDescription>
                  {report.totalKeys} total keys across {report.languages.length} languages
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadReport}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsVisible(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden">
          <Tabs defaultValue="overview" className="h-full flex flex-col">
            <TabsList className="flex-shrink-0">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="missing">
                Missing Keys
                {!report.isValid && (
                  <Badge variant="destructive" className="ml-2">
                    {report.missingTranslations.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-4">
                  {/* Overall Status */}
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Overall Status</h3>
                      {report.isValid ? (
                        <Badge variant="default" className="bg-green-600">All Complete</Badge>
                      ) : (
                        <Badge variant="destructive">
                          {report.missingTranslations.length} Missing
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {report.isValid
                        ? "All translations are complete across all languages."
                        : `Found ${report.missingTranslations.length} missing translations.`}
                    </p>
                  </div>

                  {/* Completion Rates */}
                  <div className="space-y-3">
                    <h3 className="font-semibold">Language Completion Rates</h3>
                    {report.languages.map((lang) => {
                      const rate = report.completionRate[lang];
                      const missing = groupedMissing[lang]?.length || 0;
                      
                      return (
                        <div key={lang} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-medium uppercase">{lang}</span>
                              {getCompletionBadge(rate)}
                              {missing > 0 && (
                                <span className="text-muted-foreground">
                                  ({missing} missing)
                                </span>
                              )}
                            </div>
                            <span className="font-semibold">{rate}%</span>
                          </div>
                          <Progress 
                            value={rate} 
                            className="h-2"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="missing" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                {report.isValid ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">All Translations Complete!</h3>
                    <p className="text-muted-foreground">
                      Every language has all required translation keys.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedMissing).map(([language, missing]) => (
                      <div key={language} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold uppercase">{language}</h3>
                          <Badge variant="outline">{missing.length} missing</Badge>
                        </div>
                        <div className="space-y-1">
                          {missing.map((m: MissingTranslation, index: number) => (
                            <div
                              key={`${m.language}-${m.key}-${index}`}
                              className="p-2 rounded bg-muted text-sm"
                            >
                              <code className="font-mono text-xs">{m.key}</code>
                              {m.referenceValue && (
                                <p className="text-muted-foreground mt-1 text-xs">
                                  EN: {m.referenceValue}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
