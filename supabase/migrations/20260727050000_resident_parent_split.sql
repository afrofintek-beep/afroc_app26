-- Distinguir PAI e MÃE (em vez de "Pai/Mãe" combinado). Permite validar
-- máx. 1 pai + 1 mãe = 2 progenitores por residência. O valor antigo 'parent'
-- mantém-se para os registos já existentes (mostrado como "Pai/Mãe").
-- Nota: ALTER TYPE ADD VALUE não pode correr dentro de uma transação — se o
-- editor der erro de transação, corre cada linha separadamente.
alter type public.resident_relationship add value if not exists 'father';
alter type public.resident_relationship add value if not exists 'mother';
