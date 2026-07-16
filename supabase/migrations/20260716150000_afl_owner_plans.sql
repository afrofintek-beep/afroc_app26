-- ============================================================================
-- AFROLOC — Formalizar afl_owner_plans (geodata PR-D)
--
-- A tabela é usada pelo yamioo-gateway (ações share/plan_get/plan_set) desde
-- jul/2026 mas foi criada fora do controlo de versões. Esta migração
-- torna-a reprodutível. IF NOT EXISTS: em produção é no-op.
--
-- Modelo de acesso: RLS ligada SEM policies — como afl_addresses/afl_grants/
-- afl_resolutions, só o gateway (service_role) lê/escreve. plan_set exige o
-- segredo AFROLOC_ADMIN_SECRET no gateway.
--
-- Reversão: DROP TABLE public.afl_owner_plans;
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.afl_owner_plans (
  owner_ref text PRIMARY KEY,               -- ex.: 'yamioo:<uid>' (federado, opaco)
  plan text NOT NULL DEFAULT 'gratis' CHECK (plan IN ('gratis', 'pro', 'negocio')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

ALTER TABLE public.afl_owner_plans ENABLE ROW LEVEL SECURITY;
