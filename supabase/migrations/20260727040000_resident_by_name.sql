-- Residentes por NOME (membros do agregado familiar SEM conta própria).
-- Antes o afroloc_residents exigia user_id (uma conta por residente), o que
-- impossibilitava registar uma família que partilha um telefone / cujos membros
-- (crianças, dependentes) não têm conta. Agora um residente pode ser só um NOME
-- + grau de parentesco, adicionado pelo dono do endereço.

alter table public.afroloc_residents add column if not exists full_name text;

-- user_id passa a ser opcional (null = residente só-nome, sem conta).
alter table public.afroloc_residents alter column user_id drop not null;

-- Garantir que há sempre uma identidade: OU conta (user_id) OU nome.
alter table public.afroloc_residents drop constraint if exists resident_identity_chk;
alter table public.afroloc_residents add constraint resident_identity_chk
  check (user_id is not null or full_name is not null);

-- O DONO do endereço pode adicionar residentes (incl. só-nome) ao SEU endereço.
-- (a policy antiga só permitia user_id = auth.uid(), i.e. a própria pessoa pedir).
drop policy if exists "Owner can add household members" on public.afroloc_residents;
create policy "Owner can add household members"
on public.afroloc_residents for insert
with check (
  afroloc_record_id in (select id from public.afroloc_records where user_id = auth.uid())
);
