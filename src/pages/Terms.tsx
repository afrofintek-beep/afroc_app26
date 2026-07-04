import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Termos de Utilização — MODELO INICIAL.
 * ⚠️ Rever com aconselhamento jurídico antes de produção.
 */
export default function Terms() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-strong border-b border-border/50 sticky top-0 z-40">
        <div className="container mx-auto flex h-14 items-center gap-3 px-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> {t('terms_back')}
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="font-display font-bold">{t('terms_title')}</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-10 space-y-6 text-foreground/90">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <strong>{t('terms_draft_label')}</strong> {t('terms_draft_notice')}
        </div>
        <p className="text-sm text-muted-foreground">{t('terms_last_updated')}</p>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">{t('terms_s1_heading')}</h2>
          <p>{t('terms_s1_body')}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">{t('terms_s2_heading')}</h2>
          <p>{t('terms_s2_body')}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">{t('terms_s3_heading')}</h2>
          <p>{t('terms_s3_body')}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">{t('terms_s4_heading')}</h2>
          <p>{t('terms_s4_body')}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">{t('terms_s5_heading')}</h2>
          <p>{t('terms_s5_body')}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">{t('terms_s6_heading')}</h2>
          <p>{t('terms_s6_body')}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">{t('terms_s7_heading')}</h2>
          <p>{t('terms_s7_body')}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-display font-bold">{t('terms_s8_heading')}</h2>
          <p>{t('terms_s8_body')} <a href="mailto:legal@afroloc.com" className="text-primary hover:underline">legal@afroloc.com</a></p>
        </section>
      </main>
    </div>
  );
}
