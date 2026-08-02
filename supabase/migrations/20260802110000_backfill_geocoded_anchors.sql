-- Backfill de município por reverse-geocoding (OpenStreetMap/Nominatim) das
-- âncoras cujo level2_name estava por resolver ("Luanda"/"Bengo"/etc.).
-- Só os casos em que o OSM nomeou explicitamente um município da lista oficial
-- (todos dentro de Luanda). Reversível/auditado. Fonte: osm_reverse_zoom12.
begin;
create temporary table _g_before on commit drop as
select id, code, level2_code, level2_name from public.afroloc_records;

-- GPS em Cacuaco (o nome anterior "Barra do Bengo"/"Bengo" estava corrompido;
-- as coordenadas caem em Cacuaco/Panguila, província de Luanda).
update public.afroloc_records set level2_code='AO-LDA-CACUACO', level2_name='Cacuaco', updated_at=now()
  where code in ('AO-LDA-BAR-GEN-G10-373T-N23FL','AO-LDA-BEN-GEN-G10-37ID-N230T');
-- GPS no Talatona / Belas.
update public.afroloc_records set level2_code='AO-LDA-TALATONA', level2_name='Talatona', updated_at=now()
  where code='AO-LDA-LUA-GEN-G10-3554-N25EP';
update public.afroloc_records set level2_code='AO-LDA-BELAS', level2_name='Belas', updated_at=now()
  where code='AO-LDA-LUA-GEN-G10-355D-N25P3';

insert into public.security_audit_log (action, function_name, user_id, details)
select 'backfill_geocoded_anchor','migration_20260802110000', null,
  jsonb_build_object('code',a.code,'antes',b.level2_name,'depois',a.level2_name,
    'l2_antes',b.level2_code,'l2_depois',a.level2_code,'fonte','osm_reverse_zoom12')
from public.afroloc_records a join _g_before b on b.id=a.id
where b.level2_code is distinct from a.level2_code;
commit;
