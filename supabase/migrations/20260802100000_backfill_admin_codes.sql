-- Backfill de codificação administrativa das âncoras AFROLOC.
-- Reconcilia os registos contra as listas OFICIAIS (public.administrative_divisions),
-- corrigindo apenas metadados onde a PROVÍNCIA já está correta (Luanda).
-- NÃO altera o código AFROLOC (não há regeneração) e NÃO toca em registos
-- suspeitos de província errada — esses ficam para revisão humana.
-- Reversível: transação única; só escreve level1_code/level2_code/level3_*.

begin;

-- Instantâneo do "antes" para auditoria (o que vai mudar e como).
create temporary table _bf_before on commit drop as
select id, code, level1_code, level2_code, level3_code, level3_name
from public.afroloc_records;

-- T1: level2_name = município oficial, MESMA província, level2_code em falta/errado.
update public.afroloc_records r
set level2_code = m.code, updated_at = now()
from public.administrative_divisions m
where m.level = 2
  and lower(trim(r.level2_name)) = lower(trim(m.name))
  and m.parent_code = r.level1_code
  and r.level2_code is distinct from m.code;

-- T1b: Talatona com prefixo AO-LUA (a mesma Luanda) -> normalizar para AO-LDA.
--       O código do registo (AO-LDA-TAL-...) já indica LDA; alinham-se os metadados.
update public.afroloc_records r
set level1_code = 'AO-LDA',
    level2_code = 'AO-LDA-TALATONA',
    updated_at  = now()
where lower(trim(r.level2_name)) = 'talatona'
  and r.level1_name = 'Luanda'
  and (r.level1_code = 'AO-LUA' or r.level2_code = 'AO-LUA-TALATONA');

-- T2: level2_name = comuna oficial de Luanda -> definir município pai + registar
--     a comuna em level3. Guardado por level2_code is null (não desfaz T1).
update public.afroloc_records r
set level2_code = c.parent_code,
    level3_code = c.code,
    level3_name = c.name,
    updated_at  = now()
from public.administrative_divisions c
where c.level = 3
  and lower(trim(r.level2_name)) = lower(trim(c.name))
  and left(c.parent_code, 6) = 'AO-LDA'
  and r.level1_name = 'Luanda'
  and r.level2_code is null;

-- Auditoria: regista no security_audit_log um resumo das linhas alteradas.
insert into public.security_audit_log (action, function_name, user_id, details)
select 'backfill_admin_codes', 'migration_20260802100000', null,
  jsonb_build_object(
    'code', a.code,
    'antes', jsonb_build_object('l1', b.level1_code, 'l2', b.level2_code, 'l3', b.level3_code),
    'depois', jsonb_build_object('l1', a.level1_code, 'l2', a.level2_code, 'l3', a.level3_code))
from public.afroloc_records a
join _bf_before b on b.id = a.id
where b.level1_code is distinct from a.level1_code
   or b.level2_code is distinct from a.level2_code
   or b.level3_code is distinct from a.level3_code;

commit;
