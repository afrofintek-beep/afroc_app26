import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WitnessPolicy {
  /** Nº mínimo de testemunhas confirmadas. */
  minRequired: number;
  /** Raio de proximidade (metros). */
  radiusM: number;
  /** Fase experimental: aceitar testemunha CERTIFICADA sem validações-vizinho. */
  bootstrapRelax: boolean;
  loading: boolean;
}

const DEFAULTS: Omit<WitnessPolicy, "loading"> = {
  minRequired: 3,
  radiusM: 100,
  bootstrapRelax: false,
};

const KEYS = ["witness_min_required", "witness_radius_m", "witness_bootstrap_relax"] as const;

/** Lê a política de testemunhas de app_settings (com valores por omissão seguros). */
export function useWitnessPolicy(): WitnessPolicy {
  const [policy, setPolicy] = useState<WitnessPolicy>({ ...DEFAULTS, loading: true });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("key, value")
          .in("key", KEYS as unknown as string[]);
        if (!active) return;
        const map = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
        setPolicy({
          minRequired: Number(map.get("witness_min_required") ?? DEFAULTS.minRequired) || DEFAULTS.minRequired,
          radiusM: Number(map.get("witness_radius_m") ?? DEFAULTS.radiusM) || DEFAULTS.radiusM,
          bootstrapRelax: map.get("witness_bootstrap_relax") === true,
          loading: false,
        });
      } catch {
        if (active) setPolicy({ ...DEFAULTS, loading: false });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return policy;
}
