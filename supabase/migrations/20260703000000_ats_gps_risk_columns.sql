-- Fase A da proteção de PI: tornar o servidor a fonte autoritativa do
-- Address Trust Score (ATS) e da deteção de GPS spoofing, para que estes
-- algoritmos deixem de ser calculados (e enviados) no frontend público.
--
-- Estas colunas são preenchidas pelas edge functions (ats-engine/ats-score e
-- address-verify/address-create). O cliente passa a LER estes valores em vez
-- de recalcular localmente. Aditivo e retrocompatível (tudo NULL por defeito).

ALTER TABLE public.afroloc_records
  -- Address Trust Score (persistido pelo servidor)
  ADD COLUMN IF NOT EXISTS ats_score integer,
  ADD COLUMN IF NOT EXISTS ats_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS certification_level integer,
  ADD COLUMN IF NOT EXISTS ats_computed_at timestamptz,
  -- Veredito de deteção de GPS spoofing (servidor é o enforcer)
  ADD COLUMN IF NOT EXISTS gps_risk_score integer,
  ADD COLUMN IF NOT EXISTS gps_risk_level text,      -- none|low|medium|high|critical
  ADD COLUMN IF NOT EXISTS gps_verified boolean,
  ADD COLUMN IF NOT EXISTS gps_checked_at timestamptz;

COMMENT ON COLUMN public.afroloc_records.ats_score IS 'ATS 0-100 calculado e persistido pelo servidor (ats-engine). Cliente lê, não recalcula.';
COMMENT ON COLUMN public.afroloc_records.gps_risk_level IS 'Veredito de spoofing calculado no servidor (address-verify/create). Fonte de verdade anti-fraude.';
