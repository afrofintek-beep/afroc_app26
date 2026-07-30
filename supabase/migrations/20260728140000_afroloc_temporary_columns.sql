-- Endereços TEMPORÁRIOS: as colunas eram usadas pelo código (CreateIdentity ao
-- criar temporário, e TempAddressManager para listar/atribuir/suspender) mas
-- NUNCA foram criadas na BD → o insert do temporário falhava e a listagem dava 0.
-- Aditivas e seguras (default false): não afetam os registos existentes.
alter table public.afroloc_records
  add column if not exists is_temporary            boolean not null default false,
  add column if not exists temporary_expires_at     timestamptz,
  add column if not exists temporary_granted_by     uuid,
  add column if not exists temporary_validity_days  integer;

-- Índice parcial (a listagem filtra sempre is_temporary = true).
create index if not exists idx_afroloc_records_is_temporary
  on public.afroloc_records (is_temporary)
  where is_temporary = true;

notify pgrst, 'reload schema';
