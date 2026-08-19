-- CORREÇÃO do seed de nível 1 (províncias) para a Reforma Administrativa 2024
-- (Lei n.º 14/24). A migração original 20251113185134 semeava um conjunto
-- PRÉ-REFORMA: códigos antigos (AO-LUA, AO-BGU, AO-CAB...), mantinha
-- 'Cuando Cubango' por dividir (AO-CCU), INVENTAVA duas províncias inexistentes
-- (AO-LNE 'Luanda Norte', AO-LES 'Luanda Este') e OMITIA as novas Cubango,
-- Cuando e Moxico Leste. A base LIVE já foi corrigida à parte; esta migração
-- garante que um REBUILD das migrações semeia as 21 províncias CANÓNICAS.
-- Idempotente (não altera dados já corretos em produção).

-- 1) Remover províncias inventadas / pré-reforma que não existem na Reforma 2024.
delete from public.administrative_divisions
 where level = 1 and code in ('AO-LNE','AO-LES','AO-CCU');

-- 2) Garantir as 21 províncias canónicas (Lei 14/24, Artigo 2.º).
insert into public.administrative_divisions (country_code, code, name, level, parent_code, parent_level) values
 ('AO','AO-BGO','Bengo',1,NULL,NULL),
 ('AO','AO-BIE','Bié',1,NULL,NULL),
 ('AO','AO-BLA','Benguela',1,NULL,NULL),
 ('AO','AO-CDA','Cabinda',1,NULL,NULL),
 ('AO','AO-CDO','Cuando',1,NULL,NULL),
 ('AO','AO-CGO','Cubango',1,NULL,NULL),
 ('AO','AO-CNE','Cunene',1,NULL,NULL),
 ('AO','AO-CNO','Cuanza Norte',1,NULL,NULL),
 ('AO','AO-CSU','Cuanza Sul',1,NULL,NULL),
 ('AO','AO-HBO','Huambo',1,NULL,NULL),
 ('AO','AO-HLA','Huíla',1,NULL,NULL),
 ('AO','AO-IBE','Icolo e Bengo',1,NULL,NULL),
 ('AO','AO-LDA','Luanda',1,NULL,NULL),
 ('AO','AO-LNO','Lunda Norte',1,NULL,NULL),
 ('AO','AO-LSU','Lunda Sul',1,NULL,NULL),
 ('AO','AO-MCO','Moxico',1,NULL,NULL),
 ('AO','AO-MJE','Malanje',1,NULL,NULL),
 ('AO','AO-MLE','Moxico Leste',1,NULL,NULL),
 ('AO','AO-NBE','Namibe',1,NULL,NULL),
 ('AO','AO-UGE','Uíge',1,NULL,NULL),
 ('AO','AO-ZRE','Zaire',1,NULL,NULL)
on conflict (country_code, level, code) do update set name = excluded.name;

notify pgrst, 'reload schema';
