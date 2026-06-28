import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Smartphone, Download, QrCode, Apple, Chrome, Info, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import QRCodeLib from "qrcode";
import { useLanguage } from "@/contexts/LanguageContext";

const AppDownload = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");
  const appUrl = window.location.origin;

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform("ios");
    } else if (/android/.test(userAgent)) {
      setPlatform("android");
    }

    QRCodeLib.toDataURL(appUrl, {
      width: 300,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then(setQrCodeUrl)
      .catch((err) => console.error("Error generating QR code:", err));
  }, [appUrl]);

  const handleInstallPWA = () => {
    window.location.href = "/install";
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(appUrl);
    toast.success(t("link_copied"));
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "AFROLOC",
          text: t("share_text"),
          url: appUrl,
        });
        toast.success(t("shared_success"));
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          toast.error(t("share_error"));
        }
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate('/landing')} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("back")}
        </Button>

        <div className="text-center mb-8 md:mb-12">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
              <Smartphone className="w-10 h-10 md:w-12 md:h-12 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">{t("download_app_title")}</h1>
          <p className="text-base md:text-lg text-muted-foreground">{t("download_app_subtitle")}</p>
        </div>

        {platform === "ios" && (
          <Alert className="mb-6 md:mb-8 border-primary/50 bg-primary/5">
            <Info className="h-4 w-4" />
            <AlertTitle>{t("ios_important")}</AlertTitle>
            <AlertDescription>{t("ios_safari_required")}</AlertDescription>
          </Alert>
        )}

        <Card className="mb-6 md:mb-8">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <QrCode className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              <CardTitle className="text-xl md:text-2xl">{t("quick_install")}</CardTitle>
            </div>
            <CardDescription className="text-sm md:text-base">{t("scan_qr_code")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {qrCodeUrl && (
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <img src={qrCodeUrl} alt={t("qr_code_alt")} className="w-48 h-48 md:w-64 md:h-64" />
              </div>
            )}
            <p className="text-xs md:text-sm text-center text-muted-foreground max-w-md">{t("qr_instructions")}</p>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:gap-6 mb-6 md:mb-8">
          {platform === "ios" && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Apple className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg md:text-xl">{t("iphone_ipad")}</CardTitle>
                </div>
                <CardDescription className="text-sm">{t("install_as_pwa")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                  <p className="text-sm font-semibold mb-3 text-primary">⚠️ {t("ios_attention")}</p>
                  <ol className="space-y-3 text-sm">
                    <li className="flex gap-3 items-start"><span className="font-bold text-primary min-w-[24px] h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">1</span><span>{t("ios_step1")}</span></li>
                    <li className="flex gap-3 items-start"><span className="font-bold text-primary min-w-[24px] h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">2</span><span>{t("ios_step2")}</span></li>
                    <li className="flex gap-3 items-start"><span className="font-bold text-primary min-w-[24px] h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">3</span><span>{t("ios_step3")}</span></li>
                    <li className="flex gap-3 items-start"><span className="font-bold text-primary min-w-[24px] h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">4</span><span>{t("ios_step4")}</span></li>
                    <li className="flex gap-3 items-start"><span className="font-bold text-primary min-w-[24px] h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">5</span><span>{t("ios_step5")}</span></li>
                  </ol>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCopyLink} variant="outline" className="flex-1" size="lg">{t("copy_link")}</Button>
                  <Button onClick={handleShare} className="flex-1" size="lg"><Apple className="mr-2 h-4 w-4" />{t("share")}</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {platform === "android" && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Chrome className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg md:text-xl">{t("android")}</CardTitle>
                </div>
                <CardDescription className="text-sm">{t("install_directly")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ol className="space-y-2 text-sm">
                  <li className="flex gap-2"><span className="font-semibold min-w-[20px]">1.</span><span>{t("android_step1")}</span></li>
                  <li className="flex gap-2"><span className="font-semibold min-w-[20px]">2.</span><span>{t("android_step2")}</span></li>
                  <li className="flex gap-2"><span className="font-semibold min-w-[20px]">3.</span><span>{t("android_step3")}</span></li>
                  <li className="flex gap-2"><span className="font-semibold min-w-[20px]">4.</span><span>{t("android_step4")}</span></li>
                </ol>
                <Button onClick={handleInstallPWA} className="w-full" size="lg"><Download className="mr-2 h-4 w-4" />{t("install_application")}</Button>
              </CardContent>
            </Card>
          )}

          {platform === "desktop" && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg md:text-xl">{t("mobile_access")}</CardTitle>
                </div>
                <CardDescription className="text-sm">{t("use_smartphone")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{t("to_install_mobile")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button onClick={handleShare} variant="outline" className="w-full"><Download className="mr-2 h-4 w-4" />{t("share_link")}</Button>
                  <Button onClick={handleCopyLink} variant="outline" className="w-full"><QrCode className="mr-2 h-4 w-4" />{t("copy_link")}</Button>
                </div>
                <p className="text-xs text-center text-muted-foreground">{t("scan_qr_above")}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="bg-muted/50">
          <CardHeader><CardTitle className="text-lg md:text-xl">{t("app_features")}</CardTitle></CardHeader>
          <CardContent>
            <ul className="grid gap-3 sm:grid-cols-2 text-sm">
              <li className="flex items-start gap-2"><span className="text-primary text-lg">✓</span><span>{t("feature_offline_access")}</span></li>
              <li className="flex items-start gap-2"><span className="text-primary text-lg">✓</span><span>{t("feature_witness_photos")}</span></li>
              <li className="flex items-start gap-2"><span className="text-primary text-lg">✓</span><span>{t("feature_auto_geolocation")}</span></li>
              <li className="flex items-start gap-2"><span className="text-primary text-lg">✓</span><span>{t("feature_validation_notifications")}</span></li>
              <li className="flex items-start gap-2"><span className="text-primary text-lg">✓</span><span>{t("feature_mobile_optimized")}</span></li>
              <li className="flex items-start gap-2"><span className="text-primary text-lg">✓</span><span>{t("feature_native_app")}</span></li>
            </ul>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-xs md:text-sm text-muted-foreground">{t("pwa_no_store")}</p>
          <p className="text-xs text-muted-foreground mt-2">{t("compatible_versions")}</p>
        </div>
      </div>
    </div>
  );
};

export default AppDownload;
