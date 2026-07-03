import { Users, Globe, Languages, Grid3x3 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Faixa de prova social HONESTA (a app é nova — sem números de utilizadores
 * inventados). Combina a escala real do problema + factos do produto +
 * enquadramento de pioneiro.
 */
const items = [
  { icon: Users, value: "+500M", key: "proof_without_address" },
  { icon: Globe, value: "54", key: "proof_countries" },
  { icon: Languages, value: "13", key: "proof_languages" },
  { icon: Grid3x3, value: "10×10 m", key: "proof_precision" },
];

export function SocialProofBand() {
  const { t } = useLanguage();

  return (
    <section className="border-y border-border/50 bg-muted/20 relative">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          {items.map(({ icon: Icon, value, key }) => (
            <div key={key} className="flex flex-col items-center text-center gap-1.5">
              <Icon className="h-5 w-5 text-primary mb-1" />
              <span className="text-2xl sm:text-3xl font-display font-bold">{value}</span>
              <span className="text-xs text-muted-foreground leading-snug max-w-[9rem]">{t(key)}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground/80 mt-8">{t("proof_pioneer_note")}</p>
      </div>
    </section>
  );
}
