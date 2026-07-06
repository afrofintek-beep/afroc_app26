-- WebAuthn / Passkeys — login biométrico no browser/PWA (Face ID, Touch ID,
-- impressão digital via o próprio browser do telemóvel). Rota paralela à
-- biometria nativa (capacitor-native-biometric), que só funciona em app nativa.

-- Credenciais (chave pública) registadas por cada utilizador.
create table if not exists public.webauthn_credentials (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  phone_number  text,
  credential_id text not null unique,          -- base64url do rawId
  public_key    text not null,                 -- base64url da chave pública COSE
  counter       bigint not null default 0,
  transports    text[],
  device_name   text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

create index if not exists webauthn_credentials_user_idx  on public.webauthn_credentials(user_id);
create index if not exists webauthn_credentials_phone_idx on public.webauthn_credentials(phone_number);

alter table public.webauthn_credentials enable row level security;

-- O utilizador vê e apaga apenas as suas credenciais.
-- INSERT/UPDATE são feitos só pelas edge functions (service_role, que salta a RLS).
drop policy if exists "webauthn own select" on public.webauthn_credentials;
create policy "webauthn own select" on public.webauthn_credentials
  for select using (auth.uid() = user_id);

drop policy if exists "webauthn own delete" on public.webauthn_credentials;
create policy "webauthn own delete" on public.webauthn_credentials
  for delete using (auth.uid() = user_id);

-- Grants padrão Supabase (a RLS ainda restringe as linhas).
grant select, delete on public.webauthn_credentials to authenticated;

-- Desafios efémeros (challenge) para registo e login. Só o service_role acede.
create table if not exists public.webauthn_challenges (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid,
  phone_number text,
  challenge    text not null,                  -- base64url
  type         text not null check (type in ('register','login')),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '5 minutes')
);

create index if not exists webauthn_challenges_lookup_idx
  on public.webauthn_challenges(user_id, phone_number, type);

alter table public.webauthn_challenges enable row level security;
-- RLS ligada e SEM políticas => nega a authenticated/anon; só o service_role lê/escreve.
