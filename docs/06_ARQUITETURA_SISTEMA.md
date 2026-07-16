# Manual 6 — Arquitetura do Sistema

| | |
|---|---|
| **Versão do documento** | 1.0.0 |
| **Data** | 2026-07-08 |
| **Aplica-se a** | AFROLOC app 1.0.0 |
| **Estatuto** | Fonte da verdade |
| **Classificação** | Interno (I) |

> Documento interno. Descreve a arquitetura técnica do sistema AFROLOC. Todas as afirmações estão ancoradas no código do repositório. Onde algo não pôde ser confirmado diretamente no código, está marcado com `⚠️ a validar`.

---

## 1. Âmbito

Este manual descreve a **visão de arquitetura** da aplicação AFROLOC — o sistema de gestão de identidade e endereçamento digital para África. Cobre:

- As três camadas do sistema (cliente Vite/React + Capacitor · Edge Functions Deno no Supabase · Postgres com RLS).
- O sistema **hierárquico administrativo de 5 níveis** (Nacional → Local) e o sistema de **níveis de autorização/confiança de utilizador** (Nível 1 a 5). São dois eixos distintos que partilham a numeração 1–5 — ver secção 3.
- As categorias das ~87 Edge Functions (autenticação, endereços, PoDP, telecom, KPIs, etc.).
- Segurança de dados via RLS (Row-Level Security).
- Integrações externas (Mapbox, telecom/OpenCelliD, ecossistema Yamioo).

Não cobre: detalhe do algoritmo do codec de endereços (ver `docs/SPEC_CODEC_AFROLOC.md`), nem procedimentos operacionais.

**Fontes primárias absorvidas neste manual:**
- `public/HIERARCHICAL_SYSTEM.md`
- `public/AUTHORIZATION_SYSTEM.md`
- `src/App.tsx` (rotas)
- `src/integrations/supabase/client.ts` (cliente)
- `supabase/functions/` (Edge Functions)
- `supabase/migrations/` (esquema/RLS)

---

## 2. Camadas

O AFROLOC segue uma arquitetura de três camadas com backend serverless sobre Supabase.

### 2.1 Diagrama textual

```
┌──────────────────────────────────────────────────────────────────┐
│  CAMADA 1 — CLIENTE                                                 │
│  • Web: Vite + React + React Router (SPA, rotas lazy-loaded)        │
│  • Mobile: Capacitor (appId com.afroloc.app, deep link "afroloc")  │
│  • PWA: prompt de instalação, modo offline (OfflineCreateIdentity)  │
│  • Providers: Auth · Language(i18n) · Theme(next-themes) · Query    │
└───────────────────────────────┬────────────────────────────────────┘
                                 │  HTTPS
                                 │  supabase-js (JWT em localStorage)
                                 │  + chamadas a Edge Functions
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  CAMADA 2 — EDGE FUNCTIONS (Deno, no Supabase)                      │
│  ~87 funções. Categorias: auth · endereços · PoDP · telecom ·      │
│  KPIs · validação/testemunhas · admin · ecossistema/webhooks       │
│  Helpers partilhados em _shared/ (RBAC, CORS, SMS, spoofing…)      │
│  verify_jwt por função (config.toml) — algumas públicas            │
└───────────────────────────────┬────────────────────────────────────┘
                                 │  service role / RPC
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  CAMADA 3 — POSTGRES (Supabase) + RLS                              │
│  • Tabelas de identidade, endereços, testemunhas, divisões admin   │
│  • Row-Level Security em todas as tabelas sensíveis                 │
│  • Funções SECURITY DEFINER (has_role, has_min_level, …)           │
│  • Auditoria (security_audit_log) · Storage (buckets)              │
│  ~146 migrações versionadas                                        │
└──────────────────────────────────────────────────────────────────┘

Integrações externas (via Edge Functions, nunca com segredos no cliente):
  Mapbox  ·  OpenCelliD / torres celulares  ·  Yamioo (ecossistema)  ·  SMS/OTP
```

### 2.2 Camada 1 — Cliente

- **Stack**: Vite + React, com React Router (`BrowserRouter`) — confirmado em `src/App.tsx`. Todas as páginas são **lazy-loaded** (`lazy(() => import(...))`) para code-splitting.
- **Estado de servidor**: TanStack React Query (`QueryClientProvider`).
- **Providers globais** (ordem em `App.tsx`): `ErrorBoundary` → `QueryClientProvider` → `ThemeProvider` (next-themes, tema por defeito `dark`) → `TooltipProvider` → `LanguageProvider` (i18n) → `AuthProvider`.
- **Mobile**: Capacitor — `capacitor.config.ts` define `appId: com.afroloc.app`, `appName: AFROLOC`, `webDir: dist`, esquema de deep-link `afroloc`, plugins SplashScreen e Camera.
- **PWA/Offline**: `PWAInstallPrompt` montado à raiz; existem rotas `/offline-create` e `/offline-sync` para criação de identidade sem rede.
- **Cliente Supabase** (`src/integrations/supabase/client.ts`): criado com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; sessão persistida em `localStorage`, com `persistSession` e `autoRefreshToken` ativos.
- **Nome/versão**: fonte única em `src/lib/version.ts` — `APP_NAME = "AFROLOC"`, versão derivada de `package.json`.

### 2.3 Camada 2 — Edge Functions (Deno)

Backend serverless em Deno, alojado no Supabase. Cada função vive em `supabase/functions/<nome>/`. Helpers partilhados em `supabase/functions/_shared/`:

- `auth_rbac.ts` — RBAC, construção do `AuthUser` (roles + `authorization_level` + jurisdição), CORS por origem permitida (`afroloc.com`, `afroloc.ao`, Vercel, localhost) e cabeçalhos de segurança (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, etc.).
- `sms.ts`, `hash_utils.ts`, `settings.ts`, `spoofing.ts`, `webauthn.ts`.

O ficheiro `supabase/config.toml` define `verify_jwt` por função. Funções deliberadamente **públicas** (`verify_jwt = false`) incluem, entre outras: `phone-login`, `biometric-login`, `validate-signup`, `receive-afroloc-request`, `receive-witness-sms`, `address-gateway`, `cleanup-expired-otps`, `qg-engine`, `sq-engine`. As restantes exigem JWT.

### 2.4 Camada 3 — Postgres + RLS

- Base de dados Postgres gerida pelo Supabase.
- **~146 migrações** versionadas em `supabase/migrations/` (ficheiros `AAAAMMDD......sql`), da primeira em 2025-11-10 à mais recente em 2025-12-26.
- Segurança por **Row-Level Security** e funções `SECURITY DEFINER` (ver secção 5).
- Auditoria em `security_audit_log` (referida em `HIERARCHICAL_SYSTEM.md`).
- Storage do Supabase para documentos/ficheiros. ⚠️ a validar (buckets específicos não inspecionados neste manual).

---

## 3. Níveis de autorização (5)

**Atenção — dois eixos distintos partilham a numeração 1–5.** Ambos foram absorvidos das fontes primárias.

### 3.1 Eixo A — Hierarquia administrativa (funcionários)
Fonte: `public/HIERARCHICAL_SYSTEM.md`. Define **quem administra o quê**, geograficamente.

| Nível | Papel | Jurisdição | Cria o nível abaixo |
|-------|-------|-----------|---------------------|
| **N5** | Administrador Nacional | Todo o país | N4 (Provinciais) |
| **N4** | Administrador Provincial | Província/Estado | N3 (Territoriais) |
| **N3** | Administrador Territorial | Território/Município | N2 (Comunais) |
| **N2** | Administrador Comunal | Comuna/Distrito | N1 (Agentes Locais) |
| **N1** | Agente Local | Quartier/Bairro | — (registo direto de cidadãos) |

- **Delegação em cascata**: cada nível superior cria e supervisiona o nível imediatamente inferior dentro da sua jurisdição.
- **Tabelas de suporte**: `countries` (países ativos e rótulos de nível por país), `administrative_divisions` (divisões geográficas hierárquicas com `parent_code`), `user_authorization_levels` (nível corrente + `jurisdiction_*_code`), `user_roles` (`citizen`/`moderator`/`admin`).
- **Multi-nacional**: o modelo é continental — rótulos de nível configuráveis por país (`level1_label` … `level4_label`), permitindo terminologia local (Província/Estado, Comuna/Distrito, etc.).

### 3.2 Eixo B — Nível de confiança do utilizador (cidadão)
Fonte: `public/AUTHORIZATION_SYSTEM.md`. Define **o que um utilizador comum pode fazer**, com base em atividade e verificações. Calculado no servidor.

| Nível | Nome | Critério-chave | Desbloqueia |
|-------|------|----------------|-------------|
| **1** | Basic | Conta registada, email verificado | 1 registo AFRO ID (rascunho) |
| **2** | Verified | ≥1 AFRO ID, perfil 100%, endereço válido | Até 5 registos, pedir testemunhas |
| **3** | Trusted | 2+ testemunhas confirmadas, conta 7+ dias | **Pode ser testemunha de outros** |
| **4** | Certified | 1+ validação oficial de autoridade | Prioridade, até 10 registos, pedir papel de moderador |
| **5** | Elite | 3+ AFRO IDs validados, 10+ como testemunha, 90+ dias, 95%+ taxa | Registos ilimitados, analytics avançado |

- **Tabela**: `user_authorization_levels` (`current_level` CHECK 1–5, contadores de testemunhas/validações, idade da conta, `afroid_count`, timestamps).
- **Funções-chave**: `calculate_user_authorization_level(_user_id)`, `update_user_authorization_level(_user_id)`, `has_min_level(_user_id, _min_level)` (usada em RLS).
- **Recálculo automático** por triggers: `on_profile_updated`, `on_afroid_record_updated`, `on_witness_updated`, `on_validation_created`. Recálculo manual via Edge Function `recalculate-authorization-levels`.
- **UI**: componentes `AuthorizationLevelBadge`, `AuthorizationLevelProgress`, `LevelGate` (renderização condicional por nível mínimo); hook `useAuthorizationLevel`.
- **Garantia**: os níveis não podem ser manipulados pelo cliente — cálculo server-side em funções `SECURITY DEFINER`.

### 3.3 Controlo de acesso no cliente
`src/components/ProtectedRoute.tsx` protege rotas: exige utilizador autenticado (senão redireciona para `/login`); com `requireAdmin`, verifica em `user_roles` se o utilizador tem um dos papéis `admin`, `admin_national`, `admin_province`, `admin_municipality` (senão redireciona para `/dashboard`). Em `App.tsx`, as rotas `/admin/*` estão maioritariamente envolvidas em `<ProtectedRoute requireAdmin>`. Nota: esta é uma verificação de UX no cliente; a autorização efetiva é imposta por RLS e pelos helpers RBAC do servidor.

---

## 4. Edge functions (por categoria)

São **~87 funções** em `supabase/functions/`. Agrupadas por finalidade (classificação funcional; algumas funções servem mais de um propósito):

### 4.1 Autenticação, 2FA e biometria
`auth` · `phone-login` · `biometric-login` · `register-biometric-device` · `webauthn-register-options` · `webauthn-register-verify` · `send-signup-otp` · `verify-signup-otp` · `validate-signup` · `send-admin-2fa` · `verify-admin-2fa` · `generate-backup-codes` · `verify-backup-code` · `send-change-phone-otp` · `verify-change-phone-otp` · `cleanup-expired-otps` · `delete-user` · `admin-users` · `test-auth-rbac`

### 4.2 Endereços / codec / geoespacial
`address-create` · `address-gateway` · `address-verify` · `format` · `normalize` · `validate` · `resolve-zone` · `qg-engine` · `sq-engine` · `batch-resolve` · `batch-assign-qgsq` · `import-urban-zones` · `urban-zones-clear` · `urban-zones-status` · `export-geojson` · `sync-places`

### 4.3 PoDP (Proof of Daily Presence)
`podp-admin` · `podp-rollup` · `podp-sample` · `resident-checkin`

### 4.4 Telecom / anti-spoofing / mobilidade
`telecom-fusion` · `ats-engine` · `ats-score` · `import-cell-towers` · `import-opencellid` · `mobility-api` · `archive-gps-history`

### 4.5 Testemunhas e validação
`send-witness-otp` · `verify-witness-otp` · `receive-witness-sms` · `notify-witness-contract-download` · `send-validation-reminder` · `notify-requester-validation` · `check-risk-alerts` · `send-risk-alert` · `send-fraud-alert-email`

### 4.6 KPIs / relatórios / exportação
`kpis-summary-csv` · `kpis-timeseries-csv` · `kpis-growth-csv` · `kpis-by-province-csv` · `kpis-by-admin-csv` · `csv-export` · `send-weekly-analytics-report` · `audit-log`

### 4.7 Ecossistema / API pública / webhooks (Yamioo & parceiros)
`api-v1` · `v1-docs` · `yamioo-gateway` · `manage-yamioo-agents` · `receive-afroloc-request` · `assign-afroloc-request` · `complete-afroloc-request` · `lookup-requester` · `receive-webhook` · `webhook-dispatch` · `delivery-register` · `delivery-confirm` · `delivery-list` · `delivery-revoke` · `delivery-set-primary`

### 4.8 Integrações, notificações e utilitários
`get-mapbox-token` · `send-push-notification` · `send-contact-email` · `send-document-status-email` · `translate-keys` · `recalculate-authorization-levels` · `seed-test-data` · `download-source`

> Nota: a lista completa de diretórios está em `supabase/functions/`. Algumas entradas aí (`_shared`, `ROUTE_PROTECTION.md`) são helpers/documentação e não funções deployáveis.

---

## 5. Dados & RLS

- **Row-Level Security** aplicada às tabelas sensíveis; políticas usam funções `SECURITY DEFINER` — `has_role(uid, role)` e `has_min_level(uid, level)` — para evitar recursão e escalada de privilégios (padrão confirmado em `HIERARCHICAL_SYSTEM.md` e `AUTHORIZATION_SYSTEM.md`).
- **Princípios** (do modelo hierárquico):
  1. **Hierarquia de supervisão** — cada nível vê/gere apenas níveis inferiores na sua jurisdição; não vê iguais/superiores (exceto admin global).
  2. **Segregação geográfica** — validada por `jurisdiction_*_code` (ex.: admin de Luanda não acede a Benguela).
  3. **Auditoria completa** — ações registadas em `security_audit_log`.
- **Exemplos de políticas** (de `HIERARCHICAL_SYSTEM.md`):
  - `user_roles`: só admins gerem (`has_role(auth.uid(), 'admin')`).
  - `profiles`: utilizador vê o próprio; admin vê todos.
  - `user_authorization_levels`: admins veem todos; níveis calculados server-side.
- **Cálculo server-side**: níveis de confiança e estatísticas são recalculados por triggers e funções definer, nunca pelo cliente (garantia anti-manipulação).
- **Migrações**: ~146 ficheiros em `supabase/migrations/` versionam esquema, RLS, funções e triggers.
- **CORS/segurança de API**: `_shared/auth_rbac.ts` restringe origens permitidas e aplica cabeçalhos de segurança a todas as respostas.

⚠️ a validar: o inventário exaustivo de tabelas e políticas RLS não foi extraído linha-a-linha das 146 migrações neste manual; as afirmações acima refletem os padrões documentados e os helpers partilhados.

---

## 6. Integrações

- **Mapbox** — nunca exposto com segredo no cliente. A Edge Function `get-mapbox-token` valida o `Authorization` do pedido e devolve/usa `MAPBOX_PUBLIC_TOKEN` (env), aceitando `latitude`, `longitude`, `search`, `country`. O cliente obtém o que precisa através desta função (padrão de token servido pelo servidor).
- **Telecom / OpenCelliD** — importação e fusão de dados de torres celulares para geolocalização e anti-spoofing: `import-opencellid`, `import-cell-towers`, `telecom-fusion`, e os motores `ats-engine`/`ats-score` (Address Trust Score / anti-spoofing). Helper `_shared/spoofing.ts`.
- **Ecossistema (Yamioo & parceiros)** — integração por pedido/reivindicação: `yamioo-gateway`, `manage-yamioo-agents`, o par de webhooks (`receive-webhook`/`webhook-dispatch`) e o fluxo de pedidos AFROLOC (`receive-afroloc-request` → `assign-afroloc-request` → `complete-afroloc-request`). API pública versionada em `api-v1`/`v1-docs`. Cabeçalho de parceiro `x-afroloc-partner-key` suportado no CORS.
- **SMS / OTP** — envio e receção de OTP para signup, testemunhas e mudança de telefone (`send-*-otp`, `verify-*-otp`, `receive-witness-sms`), via `_shared/sms.ts`.
- **Email** — `send-contact-email`, `send-document-status-email`, `send-fraud-alert-email`, `send-weekly-analytics-report`, `send-risk-alert`.
- **Push** — `send-push-notification`.

---

## 7. Changelog

| Versão | Data | Alteração |
|--------|------|-----------|
| 1.0.0 | 2026-07-08 | Versão inicial do Manual 6 — Arquitetura do Sistema. Ancorado no repositório AFROLOC_source_clean (app 1.0.0). |
