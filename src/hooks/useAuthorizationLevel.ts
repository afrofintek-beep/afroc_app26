/**
 * AFROLOC - African Digital Address Identification System
 * 
 * Copyright (c) 2024-2026 AFROFINTEK GmbH. All rights reserved.
 * 
 * This file is part of the AFROLOC proprietary software.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited.
 * 
 * For licensing inquiries, contact: legal@afroloc.com
 * 
 * @module 5-Tier Authorization Level System
 * @description Manages user authorization levels from Quarteirão (L1) to Provincial (L5)
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export interface AuthorizationLevel {
  id: string;
  user_id: string;
  current_level: number;
  administrative_role: string;
  jurisdiction_country: string;
  jurisdiction_level1_code: string;
  jurisdiction_level1_name: string;
  jurisdiction_level2_code: string;
  jurisdiction_level2_name: string;
  jurisdiction_level3_code: string;
  jurisdiction_level3_name: string;
  jurisdiction_level4_code: string;
  jurisdiction_level4_name: string;
  assigned_by_user_id: string;
  assigned_at: string;
  created_at: string;
  updated_at: string;
}

export const LEVEL_NAMES = {
  1: "Basic",
  2: "Verified",
  3: "Trusted",
  4: "Certified",
  5: "Elite"
} as const;

export const LEVEL_COLORS = {
  1: "bg-gray-500",
  2: "bg-blue-500",
  3: "bg-green-500",
  4: "bg-purple-500",
  5: "bg-yellow-500"
} as const;

export const LEVEL_REQUIREMENTS = {
  1: {
    name: "Quarteirão",
    description: "Funcionário de quarteirão. Registra moradores localmente.",
    requirements: [
      "Registrar AFROLOCs no quarteirão designado",
      "Criar pacotes de registros",
      "Submeter pacotes ao supervisor do bairro"
    ]
  },
  2: {
    name: "Bairro",
    description: "Supervisor de bairro. Valida pacotes do quarteirão.",
    requirements: [
      "Aprovar/rejeitar pacotes do Nível 1",
      "Consolidar registros do bairro",
      "Submeter pacotes ao chefe de distrito"
    ]
  },
  3: {
    name: "Distrito",
    description: "Chefe de distrito. Valida pacotes do bairro.",
    requirements: [
      "Aprovar/rejeitar pacotes do Nível 2",
      "Supervisionar registros do distrito",
      "Submeter pacotes ao diretor municipal"
    ]
  },
  4: {
    name: "Município",
    description: "Diretor municipal. Valida pacotes do distrito.",
    requirements: [
      "Aprovar/rejeitar pacotes do Nível 3",
      "Gerir registros municipais",
      "Submeter pacotes ao coordenador provincial"
    ]
  },
  5: {
    name: "Provincial",
    description: "Coordenador provincial/nacional. Nível máximo.",
    requirements: [
      "Aprovar/rejeitar pacotes do Nível 4",
      "Supervisionar província/país",
      "Gestão completa do sistema"
    ]
  }
} as const;

export const useAuthorizationLevel = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id || null;
      if (newUserId !== userId) {
        setUserId(newUserId);
        // Invalidate query when user changes
        queryClient.invalidateQueries({ queryKey: ["authorization-level"] });
      }
    });

    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, [queryClient, userId]);

  return useQuery({
    queryKey: ["authorization-level", userId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return {
          current_level: 1,
          administrative_role: null,
          jurisdiction_country: null
        } as Partial<AuthorizationLevel>;
      }

      const { data, error } = await supabase
        .from("user_authorization_levels")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      // If no level exists yet, return default level 1
      if (!data) {
        return {
          current_level: 1,
          administrative_role: null,
          jurisdiction_country: null
        } as Partial<AuthorizationLevel>;
      }

      return data;
    },
    enabled: !!userId,
    refetchInterval: 60000,
  });
};

export const hasMinimumLevel = (userLevel: number | undefined, requiredLevel: number): boolean => {
  if (!userLevel) return false;
  return userLevel >= requiredLevel;
};
