-- Backfill de município por reverse-geocoding OSM em zoom alto (18).
-- O OSM modela os municípios urbanos de Luanda como "Distrito Urbano da X"
-- (Maianga, Samba, Ingombota, Rangel), que correspondem 1:1 aos municípios
-- oficiais. Cada linha foi confirmada pelo bairro do OSM e, quando existe,
-- pela sigla do próprio código (ING/MAI/RAN). Todas dentro de Luanda.
-- Reversível/auditado. Fonte: osm_reverse_zoom18. NÃO inclui o registo de
-- teste malformado AO-ZU-G10-3624-N24G1 (decisão humana à parte).
begin;
create temporary table _z_before on commit drop as
select id, code, level2_code, level2_name from public.afroloc_records;

update public.afroloc_records r set
  level2_code = v.l2, level2_name = v.nome, updated_at = now()
from (values
  ('AO-LDA-GEN-G10-35NI-N247C',     'AO-LDA-MAIANGA',   'Maianga'),
  ('AO-LDA-LUA-GEN-G10-358R-N24LZ', 'AO-LDA-SAMBA',     'Samba'),
  ('AO-LDA-LUA-GEN-G10-358V-N24NL', 'AO-LDA-SAMBA',     'Samba'),
  ('AO-LDA-LUA-GEN-G10-35LY-N24AO', 'AO-LDA-MAIANGA',   'Maianga'),
  ('AO-LDA-LUA-GEN-G10-35N1-N23ZQ', 'AO-LDA-INGOMBOTA', 'Ingombota'),
  ('AO-LDA-LUA-GEN-G10-35NO-N245H', 'AO-LDA-MAIANGA',   'Maianga'),
  ('AO-LDA-LUA-GEN-G10-35R0-N23XP', 'AO-LDA-INGOMBOTA', 'Ingombota'),
  ('AO-LDA-LUA-ING-G10-35P7-N241S', 'AO-LDA-INGOMBOTA', 'Ingombota'),
  ('AO-LDA-LUA-ING-G10-35VZ-N23UZ', 'AO-LDA-INGOMBOTA', 'Ingombota'),
  ('AO-LDA-LUA-MAI-G10-35M7-N2441', 'AO-LDA-MAIANGA',   'Maianga'),
  ('AO-LDA-LUA-MAI-G10-35MU-N2443', 'AO-LDA-MAIANGA',   'Maianga'),
  ('AO-LDA-LUA-RAN-G10-35VA-N246E', 'AO-LDA-RANGEL',    'Rangel')
) as v(code, l2, nome)
where r.code = v.code;

insert into public.security_audit_log (action, function_name, user_id, details)
select 'backfill_geocoded_anchor','migration_20260802120000', null,
  jsonb_build_object('code',a.code,'antes',b.level2_name,'depois',a.level2_name,
    'l2_antes',b.level2_code,'l2_depois',a.level2_code,'fonte','osm_reverse_zoom18')
from public.afroloc_records a join _z_before b on b.id=a.id
where b.level2_code is distinct from a.level2_code;
commit;
