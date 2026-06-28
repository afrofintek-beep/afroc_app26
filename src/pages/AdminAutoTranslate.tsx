import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Languages, Download, CheckCircle, AlertCircle, Globe } from "lucide-react";

// Import all translations
import ptTranslations from '@/translations/pt.json';
import enTranslations from '@/translations/en.json';
import frTranslations from '@/translations/fr.json';
import arTranslations from '@/translations/ar.json';
import amTranslations from '@/translations/am.json';
import swTranslations from '@/translations/sw.json';
import lnTranslations from '@/translations/ln.json';
import yoTranslations from '@/translations/yo.json';
import snTranslations from '@/translations/sn.json';
import zuTranslations from '@/translations/zu.json';
import kmbTranslations from '@/translations/kmb.json';
import umbTranslations from '@/translations/umb.json';
import kgTranslations from '@/translations/kg.json';

type Language = 'en' | 'fr' | 'ar' | 'am' | 'sw' | 'ln' | 'yo' | 'sn' | 'zu' | 'kmb' | 'umb' | 'kg';

const translations: Record<Language, Record<string, string>> = {
  en: enTranslations,
  fr: frTranslations,
  ar: arTranslations,
  am: amTranslations,
  sw: swTranslations,
  ln: lnTranslations,
  yo: yoTranslations,
  sn: snTranslations,
  zu: zuTranslations,
  kmb: kmbTranslations,
  umb: umbTranslations,
  kg: kgTranslations,
};

const languageNames: Record<Language, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
  am: 'አማርኛ',
  sw: 'Kiswahili',
  ln: 'Lingála',
  yo: 'Yorùbá',
  sn: 'Shona',
  zu: 'isiZulu',
  kmb: 'Kimbundu',
  umb: 'Umbundu',
  kg: 'Kikongo',
};

const languageFlags: Record<Language, string> = {
  en: '🇬🇧',
  fr: '🇫🇷',
  ar: '🇸🇦',
  am: '🇪🇹',
  sw: '🇹🇿',
  ln: '🇨🇩',
  yo: '🇳🇬',
  sn: '🇿🇼',
  zu: '🇿🇦',
  kmb: '🇦🇴',
  umb: '🇦🇴',
  kg: '🇨🇩',
};

interface LanguageStatus {
  language: Language;
  existingKeys: number;
  totalKeys: number;
  missingKeys: number;
  completionRate: number;
  status: 'complete' | 'partial' | 'low';
  isTranslating: boolean;
  newTranslations?: Record<string, string>;
}

export default function AdminAutoTranslate() {
  const { toast } = useToast();
  const [languageStatuses, setLanguageStatuses] = useState<LanguageStatus[]>(() => {
    const ptKeys = Object.keys(ptTranslations);
    const totalKeys = ptKeys.length;
    
    return (Object.keys(translations) as Language[]).map(lang => {
      const langKeys = Object.keys(translations[lang]);
      const existingKeys = langKeys.filter(key => 
        translations[lang][key] && 
        translations[lang][key] !== ptTranslations[key as keyof typeof ptTranslations]
      ).length;
      const missingKeys = totalKeys - existingKeys;
      const completionRate = Math.round((existingKeys / totalKeys) * 100);
      
      const status: 'complete' | 'partial' | 'low' = completionRate >= 95 ? 'complete' : completionRate >= 70 ? 'partial' : 'low';
      return {
        language: lang,
        existingKeys,
        totalKeys,
        missingKeys,
        completionRate,
        status,
        isTranslating: false,
      };
    }).sort((a, b) => b.completionRate - a.completionRate);
  });

  const getMissingKeys = (lang: Language): Record<string, string> => {
    const ptKeys = Object.keys(ptTranslations) as (keyof typeof ptTranslations)[];
    const langData = translations[lang];
    const missing: Record<string, string> = {};
    
    ptKeys.forEach(key => {
      if (!langData[key] || langData[key] === ptTranslations[key]) {
        missing[key] = ptTranslations[key];
      }
    });
    
    return missing;
  };

  const translateLanguage = async (lang: Language) => {
    setLanguageStatuses(prev => prev.map(s => 
      s.language === lang ? { ...s, isTranslating: true } : s
    ));

    try {
      const missingKeys = getMissingKeys(lang);
      const missingCount = Object.keys(missingKeys).length;
      
      if (missingCount === 0) {
        toast({
          title: "Já completo",
          description: `${languageNames[lang]} já tem todas as traduções.`,
        });
        return;
      }

      toast({
        title: "Traduzindo...",
        description: `A traduzir ${missingCount} chaves para ${languageNames[lang]}`,
      });

      const { data, error } = await supabase.functions.invoke('translate-keys', {
        body: {
          sourceLanguage: 'pt',
          targetLanguage: lang,
          keys: missingKeys,
        },
      });

      if (error) throw error;

      if (data.translations) {
        setLanguageStatuses(prev => prev.map(s => 
          s.language === lang 
            ? { 
                ...s, 
                isTranslating: false,
                newTranslations: data.translations,
                existingKeys: s.existingKeys + Object.keys(data.translations).length,
                missingKeys: s.missingKeys - Object.keys(data.translations).length,
                completionRate: Math.round(((s.existingKeys + Object.keys(data.translations).length) / s.totalKeys) * 100),
              } 
            : s
        ));

        toast({
          title: "Tradução concluída!",
          description: `${Object.keys(data.translations).length} de ${missingCount} chaves traduzidas para ${languageNames[lang]}`,
        });
      }
    } catch (error) {
      console.error('Translation error:', error);
      toast({
        title: "Erro na tradução",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLanguageStatuses(prev => prev.map(s => 
        s.language === lang ? { ...s, isTranslating: false } : s
      ));
    }
  };

  const downloadTranslations = (lang: Language) => {
    const status = languageStatuses.find(s => s.language === lang);
    if (!status?.newTranslations) return;

    // Merge with existing translations
    const merged = { ...translations[lang], ...status.newTranslations };
    const sorted = Object.keys(merged).sort().reduce((acc, key) => {
      acc[key] = merged[key];
      return acc;
    }, {} as Record<string, string>);

    const blob = new Blob([JSON.stringify(sorted, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lang}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Download iniciado",
      description: `Ficheiro ${lang}.json transferido`,
    });
  };

  const getStatusBadge = (status: LanguageStatus) => {
    if (status.completionRate >= 95) {
      return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Completo</Badge>;
    }
    if (status.completionRate >= 70) {
      return <Badge className="bg-yellow-500"><AlertCircle className="h-3 w-3 mr-1" /> Parcial</Badge>;
    }
    return <Badge className="bg-red-500"><AlertCircle className="h-3 w-3 mr-1" /> Incompleto</Badge>;
  };

  const totalLanguages = languageStatuses.length;
  const completeLanguages = languageStatuses.filter(s => s.completionRate >= 95).length;
  const avgCompletion = Math.round(languageStatuses.reduce((sum, s) => sum + s.completionRate, 0) / totalLanguages);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Languages className="h-8 w-8" />
            Tradução Automática
          </h1>
          <p className="text-muted-foreground mt-2">
            Traduza automaticamente as chaves faltantes usando IA
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Línguas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalLanguages}</div>
              <p className="text-xs text-muted-foreground">suportadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{completeLanguages}</div>
              <p className="text-xs text-muted-foreground">≥95% traduzidas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Média</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgCompletion}%</div>
              <p className="text-xs text-muted-foreground">conclusão geral</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Baseline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(ptTranslations).length}</div>
              <p className="text-xs text-muted-foreground">chaves em Português</p>
            </CardContent>
          </Card>
        </div>

        {/* Language List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Estado das Traduções
            </CardTitle>
            <CardDescription>
              Clique em "Traduzir" para usar IA para traduzir as chaves faltantes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {languageStatuses.map((status) => (
                  <div 
                    key={status.language}
                    className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <span className="text-2xl">{languageFlags[status.language]}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{languageNames[status.language]}</span>
                          <span className="text-xs text-muted-foreground">({status.language})</span>
                          {getStatusBadge(status)}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Progress value={status.completionRate} className="h-2 flex-1" />
                          <span className="text-sm font-medium w-12 text-right">{status.completionRate}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {status.existingKeys} de {status.totalKeys} chaves • {status.missingKeys} em falta
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {status.newTranslations && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadTranslations(status.language)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      )}
                      <Button
                        variant={status.missingKeys > 0 ? "default" : "outline"}
                        size="sm"
                        onClick={() => translateLanguage(status.language)}
                        disabled={status.isTranslating || status.missingKeys === 0}
                      >
                        {status.isTranslating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Traduzindo...
                          </>
                        ) : status.missingKeys === 0 ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Completo
                          </>
                        ) : (
                          <>
                            <Languages className="h-4 w-4 mr-2" />
                            Traduzir ({status.missingKeys})
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">Como funciona</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. O sistema compara cada idioma com o Português (baseline com {Object.keys(ptTranslations).length} chaves)</p>
            <p>2. Identifica chaves faltantes ou não traduzidas</p>
            <p>3. Usa AI Gateway para traduzir as chaves faltantes para o idioma nativo</p>
            <p>4. Após tradução, faça download do ficheiro JSON atualizado</p>
            <p>5. Substitua o ficheiro em <code className="bg-background px-1 py-0.5 rounded">src/translations/[idioma].json</code></p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
