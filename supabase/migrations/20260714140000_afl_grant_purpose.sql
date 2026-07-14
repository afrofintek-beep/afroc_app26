-- AFROLOC — finalidade ("fim acordado") da cedência.
-- Concretiza o modelo de consentimento: cada acesso é cedido para um fim.
-- Aditivo; retrocompatível (grants antigos ficam com purpose NULL).
alter table public.afl_grants
  add column if not exists purpose text;
