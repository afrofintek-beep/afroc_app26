import { MapPin } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Cartão-produto do herói: mostra, em segundos, o que é a AFROLOC —
 * um endereço único sobre a grelha QG·SQ, com um mini-mapa ilustrativo.
 * Puramente visual (sem Mapbox, sem rede) para carregar leve em qualquer telemóvel.
 */
export function HeroAddressCard() {
  const { t } = useLanguage();
  const gridLine = "hsl(var(--foreground) / 0.10)";

  return (
    <div className="relative w-full max-w-md mx-auto animate-scale-in">
      {/* halo */}
      <div className="absolute -inset-4 bg-gradient-primary/20 rounded-[2rem] blur-2xl -z-10" />

      <div className="rounded-3xl glass-strong border border-border/50 shadow-premium p-3 sm:p-4">
        {/* Mini-mapa (grelha QG·SQ) */}
        <div className="relative aspect-[5/4] rounded-2xl overflow-hidden border border-border/40 bg-gradient-to-br from-primary/5 via-background to-accent/10">
          {/* grelha */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(${gridLine} 1px, transparent 1px), linear-gradient(90deg, ${gridLine} 1px, transparent 1px)`,
              backgroundSize: "11.11% 12.5%",
            }}
          />
          {/* célula destacada (a "morada") */}
          <div
            className="absolute bg-primary/15 border border-primary/40"
            style={{ left: "44.44%", top: "37.5%", width: "11.11%", height: "12.5%" }}
          />

          {/* badge validado */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-background/70 backdrop-blur px-2.5 py-1 border border-border/50">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[11px] font-medium">{t("hero_community_validated")}</span>
          </div>

          {/* caption */}
          <span className="absolute bottom-2.5 left-3 text-[10px] font-mono text-muted-foreground">
            {t("hero_grid_caption")}
          </span>

          {/* pin ao centro */}
          <div className="absolute" style={{ left: "50%", top: "43.75%", transform: "translate(-50%, -50%)" }}>
            <span className="absolute inset-0 -m-3 rounded-full bg-primary/30 animate-ping" />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary shadow-glow">
              <MapPin className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>

        {/* Código AFROLOC */}
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-background/60 border border-border/50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">{t("hero_your_address_label")}</p>
            <p className="font-mono text-base sm:text-lg font-bold tracking-wide truncate">
              AO-LU-G10-X35O8-YN247T
            </p>
          </div>
          <div className="shrink-0 p-2 rounded-lg bg-gradient-primary">
            <MapPin className="h-4 w-4 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
