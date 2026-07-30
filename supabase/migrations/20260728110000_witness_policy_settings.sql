-- Política de testemunhas (fase experimental) — valores ajustáveis por admin.
--  witness_min_required   : nº mínimo de testemunhas confirmadas (exibido/usado).
--  witness_radius_m       : raio de proximidade em metros (exibido).
--  witness_bootstrap_relax: se true, uma testemunha CERTIFICADA (vouched pela
--    autoridade — ex.: âncora-génese) é aceite SEM exigir linhas em
--    afroloc_validations. Quebra o arranque a frio; desligar quando a malha
--    de certificados estiver densa.
insert into public.app_settings (key, value) values
  ('witness_min_required',    '2'::jsonb),
  ('witness_radius_m',        '100'::jsonb),
  ('witness_bootstrap_relax', 'false'::jsonb)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
