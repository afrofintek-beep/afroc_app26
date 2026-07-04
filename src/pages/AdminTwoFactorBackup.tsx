import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, ArrowLeft, AlertTriangle } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import afrolocSymbol from "@/assets/afroloc-symbol.png";

export default function AdminTwoFactorBackup() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

  const userId = location.state?.userId;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("verify-backup-code", {
        body: { userId, code: code.trim() },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: t('twofabackup_toast_verified_title'),
          description: `${t('twofabackup_toast_verified_desc_prefix')} ${data.remainingCodes} ${data.remainingCodes !== 1 ? t('twofabackup_toast_verified_desc_codes_plural') : t('twofabackup_toast_verified_desc_codes_singular')} ${t('twofabackup_toast_verified_desc_suffix')}`,
        });

        if (data.remainingCodes <= 2) {
          toast({
            title: t('twofabackup_toast_low_title'),
            description: t('twofabackup_toast_low_desc'),
            variant: "destructive",
          });
        }

        navigate("/admin/import-divisions");
      } else {
        throw new Error(data.error || t('twofabackup_error_verification_failed'));
      }
    } catch (error: any) {
      toast({
        title: t('twofabackup_toast_failed_title'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/10 to-muted/30 p-4">
      <div className="absolute top-4 left-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/2fa", { state: location.state })}
          title={t('twofabackup_back_to_2fa')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>

      <Card className="w-full max-w-md border-primary/20 shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <img src={afrolocSymbol} alt="AFROLOC" className="h-14 w-14 object-cover rounded-xl shadow-md ring-1 ring-primary/20" />
              <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1.5">
                <Shield className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{t('twofabackup_title')}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {t('twofabackup_description')}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleVerify}>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-200">
                  <p className="font-semibold mb-1">{t('twofabackup_onetime_title')}</p>
                  <p>{t('twofabackup_onetime_desc')}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="backup-code">{t('twofabackup_label')}</Label>
              <Input
                id="backup-code"
                type="text"
                placeholder="XXXX-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                maxLength={9}
                className="text-center text-xl tracking-widest font-mono"
                autoComplete="off"
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-center">
                {t('twofabackup_format_hint')}
              </p>
            </div>

            <div className="text-center text-sm">
              <Button
                type="button"
                variant="link"
                onClick={() => navigate("/admin/2fa", { state: location.state })}
                className="text-primary"
              >
                {t('twofabackup_back_to_verification')}
              </Button>
            </div>
          </CardContent>

          <CardFooter>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || code.length < 8}
            >
              {loading ? t('twofabackup_btn_verifying') : t('twofabackup_btn_verify')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
