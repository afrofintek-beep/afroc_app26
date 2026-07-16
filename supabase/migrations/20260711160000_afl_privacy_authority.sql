-- ============================================================================
-- AFROLOC — AUTORIDADE DE PRIVACIDADE (central, no projeto afroc_app26)
-- A privacidade é uma propriedade do ENDEREÇO, não da app. Esta é a autoridade
-- que todas as apps do ecossistema (Yamioo, Yamilook, …) consultam via o
-- `yamioo-gateway`. Acesso SÓ pelo gateway (service_role) — RLS nega tudo o resto.
--
-- Modelo federado: cada app autentica os seus utilizadores e passa um
-- `owner_ref` opaco ('yamioo:<uid>'). A resolução por TOKEN é capacidade pura
-- (app-agnóstica). Toda a resolução fica registada (auditoria central).
-- ============================================================================

-- Endereços privados (a Camada 2 do modelo — pessoas/casas/certificados) -------
CREATE TABLE IF NOT EXISTS public.afl_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,                       -- código AFROLOC canónico
  owner_ref text NOT NULL,                  -- 'yamioo:<uid>' (app-namespaced)
  app text,                                 -- app de origem ('yamioo')
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  privacy text NOT NULL DEFAULT 'private' CHECK (privacy IN ('private','certified')),
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_ref, code)
);
CREATE INDEX IF NOT EXISTS idx_afl_addr_owner ON public.afl_addresses(owner_ref);

-- Concessões (tokens de partilha) --------------------------------------------
CREATE TABLE IF NOT EXISTS public.afl_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address_id uuid NOT NULL REFERENCES public.afl_addresses(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  scope text NOT NULL DEFAULT 'coordinate' CHECK (scope IN ('zone','coordinate')),
  label text,
  expires_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_afl_grants_addr ON public.afl_grants(address_id);
CREATE INDEX IF NOT EXISTS idx_afl_grants_token ON public.afl_grants(token);

-- Auditoria (quem resolveu) --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.afl_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address_id uuid NOT NULL,
  via text NOT NULL,                         -- token | owner | system
  caller_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_afl_res_addr ON public.afl_resolutions(address_id, created_at DESC);

-- Acesso SÓ pelo gateway (service_role ignora RLS). RLS ligada e SEM policies
-- => nenhum cliente (anon/authenticated) lê ou escreve diretamente.
ALTER TABLE public.afl_addresses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afl_grants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afl_resolutions ENABLE ROW LEVEL SECURITY;
