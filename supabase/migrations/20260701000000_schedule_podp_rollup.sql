-- PoDP — agenda o rollup diário (fecha ciclos + calcula KPI de presença) via
-- pg_cron + pg_net. Invoca a edge function `podp-rollup` todos os dias às
-- 03:00 UTC. Sem isto, as amostras GPS são recolhidas mas os ciclos nunca
-- fecham e o KPI nunca é calculado (ver PoDP_Proof_of_Daily_Presence.pdf, §4).
--
-- SEGREDOS (definidos FORA do repo, no Vault da BD live — nunca versionados):
--   vault 'podp_project_url'       = https://<project-ref>.supabase.co
--   vault 'podp_service_role_key'  = service_role key do projeto
-- Numa BD nova, popular o Vault com estes dois segredos ANTES de o cron correr;
-- caso contrário o job dispara mas o net.http_post não autentica.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotente: remove agendamento anterior se existir.
do $$
begin
  perform cron.unschedule('podp-rollup-daily');
exception when others then null;
end $$;

select cron.schedule('podp-rollup-daily', '0 3 * * *', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'podp_project_url')
           || '/functions/v1/podp-rollup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'podp_service_role_key')
    ),
    body := '{}'::jsonb
  );
$cron$);
