import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, CheckCircle2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    const android = /Android/.test(navigator.userAgent);
    setIsAndroid(android);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">{t("app_installed")}</CardTitle>
            <CardDescription>{t("app_already_installed")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => navigate('/')} className="w-full">{t("go_to_app")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("back")}
        </Button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-primary/10 mb-4">
            <Smartphone className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-3">{t("install_afroloc")}</h1>
          <p className="text-muted-foreground text-lg">{t("install_subtitle")}</p>
        </div>

        <div className="grid gap-6 mb-8">
          <Card>
            <CardHeader><CardTitle>{t("installed_benefits")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div><p className="font-medium">{t("benefit_quick_access")}</p><p className="text-sm text-muted-foreground">{t("benefit_quick_access_desc")}</p></div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div><p className="font-medium">{t("benefit_offline")}</p><p className="text-sm text-muted-foreground">{t("benefit_offline_desc")}</p></div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div><p className="font-medium">{t("benefit_native_exp")}</p><p className="text-sm text-muted-foreground">{t("benefit_native_exp_desc")}</p></div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div><p className="font-medium">{t("benefit_auto_updates")}</p><p className="text-sm text-muted-foreground">{t("benefit_auto_updates_desc")}</p></div>
              </div>
            </CardContent>
          </Card>

          {isIOS && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" />{t("how_to_install_ios")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>{t("ios_install_step1")}</li>
                  <li>{t("ios_install_step2")}</li>
                  <li>{t("ios_install_step3")}</li>
                  <li>{t("ios_install_step4")}</li>
                </ol>
              </CardContent>
            </Card>
          )}

          {isAndroid && deferredPrompt && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" />{t("install_on_android")}</CardTitle>
                <CardDescription>{t("click_to_install")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleInstallClick} className="w-full" size="lg"><Download className="h-5 w-5 mr-2" />{t("install_app_button")}</Button>
              </CardContent>
            </Card>
          )}

          {isAndroid && !deferredPrompt && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" />{t("how_to_install_android")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>{t("android_install_step1")}</li>
                  <li>{t("android_install_step2")}</li>
                  <li>{t("android_install_step3")}</li>
                  <li>{t("android_install_step4")}</li>
                </ol>
              </CardContent>
            </Card>
          )}

          {!isIOS && !isAndroid && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" />{t("how_to_install_desktop")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {deferredPrompt ? (
                  <Button onClick={handleInstallClick} className="w-full" size="lg"><Download className="h-5 w-5 mr-2" />{t("install_app_button")}</Button>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm">
                      <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">ℹ️ {t("important_note")}</p>
                      <p className="text-yellow-700 dark:text-yellow-300">{t("pwa_preview_note")}</p>
                    </div>
                    <div className="text-sm space-y-2">
                      <p className="font-medium">{t("install_after_publish")}</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>{t("chrome_edge_install")}</li>
                        <li>{t("firefox_install")}</li>
                        <li>{t("safari_install")}</li>
                      </ul>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
                      <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">📤 {t("publish_app")}</p>
                      <p className="text-blue-700 dark:text-blue-300">{t("publish_instructions")}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="text-center">
          <Button variant="outline" onClick={() => navigate('/')}>{t("continue_in_browser")}</Button>
        </div>
      </div>
    </div>
  );
};

export default Install;
