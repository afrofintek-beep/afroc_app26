import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Política de Privacidade — MODELO INICIAL.
 * ⚠️ Rever com aconselhamento jurídico antes de produção. Ajustar às leis de
 * proteção de dados aplicáveis (ex.: Lei 22/11 de Angola, RGPD para a UE).
 */
export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-strong border-b border-border/50 sticky top-0 z-40">
        <div className="container mx-auto flex h-14 items-center gap-3 px-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> {t('privacy_back')}
          </Button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-display font-bold">{t('privacy_title')}</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-10 space-y-6 text-foreground/90">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <strong>{t('privacy_draft_label')}</strong> {t('privacy_draft_notice')}
        </div>
        <p className="text-sm text-muted-foreground">{t('privacy_last_updated')}</p>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">{t('privacy_s1_heading')}</h2>
          <p>{t('privacy_s1_body')}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">{t('privacy_s2_heading')}</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>{t('privacy_s2_item1_label')}</strong> {t('privacy_s2_item1_body')}</li>
            <li><strong>{t('privacy_s2_item2_label')}</strong> {t('privacy_s2_item2_body')}</li>
            <li><strong>{t('privacy_s2_item3_label')}</strong> {t('privacy_s2_item3_body')}</li>
            <li><strong>{t('privacy_s2_item4_label')}</strong> {t('privacy_s2_item4_body')}</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">{t('privacy_s3_heading')}</h2>
          <p>{t('privacy_s3_body')}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">{t('privacy_s4_heading')}</h2>
          <p>{t('privacy_s4_body')}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">{t('privacy_s5_heading')}</h2>
          <p>{t('privacy_s5_body')}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">{t('privacy_s6_heading')}</h2>
          <p>{t('privacy_s6_body')}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">{t('privacy_s7_heading')}</h2>
          <p>{t('privacy_s7_body')} <a href="mailto:privacy@afroloc.com" className="text-primary hover:underline">privacy@afroloc.com</a></p>
        </section>
      </main>
    </div>
  );
}
