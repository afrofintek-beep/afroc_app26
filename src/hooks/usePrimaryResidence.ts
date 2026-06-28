import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PrimaryResidence {
  id: string;
  code: string;
  country: string;
  level1_name: string | null;
  level2_name: string | null;
  level3_name: string | null;
  level4_name: string | null;
  street_name: string | null;
  number: string | null;
  status: string | null;
  geo_lat: number | null;
  geo_lon: number | null;
}

export function usePrimaryResidence() {
  const [primaryResidence, setPrimaryResidence] = useState<PrimaryResidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPrimaryResidence, setHasPrimaryResidence] = useState(false);
  const [totalAddresses, setTotalAddresses] = useState(0);

  const loadPrimaryResidence = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      // Get total address count
      const { count: addressCount } = await supabase
        .from("afroloc_records")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.user.id);

      setTotalAddresses(addressCount || 0);

      // Get primary residence
      const { data, error } = await supabase
        .from("afroloc_records")
        .select("id, code, country, level1_name, level2_name, level3_name, level4_name, street_name, number, status, geo_lat, geo_lon")
        .eq("user_id", session.user.id)
        .eq("is_primary_residence", true)
        .maybeSingle();

      if (error) throw error;

      setPrimaryResidence(data);
      setHasPrimaryResidence(!!data);
    } catch (error) {
      console.error("Error loading primary residence:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrimaryResidence();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadPrimaryResidence();
    });

    return () => subscription.unsubscribe();
  }, []);

  const formatAddress = (residence: PrimaryResidence | null): string => {
    if (!residence) return "";
    
    const parts = [
      residence.street_name,
      residence.number,
      residence.level4_name,
      residence.level3_name,
      residence.level2_name,
      residence.level1_name
    ].filter(Boolean);
    
    return parts.join(", ");
  };

  const requiresPrimarySelection = totalAddresses > 0 && !hasPrimaryResidence;

  return {
    primaryResidence,
    hasPrimaryResidence,
    totalAddresses,
    loading,
    requiresPrimarySelection,
    formatAddress,
    refresh: loadPrimaryResidence
  };
}
