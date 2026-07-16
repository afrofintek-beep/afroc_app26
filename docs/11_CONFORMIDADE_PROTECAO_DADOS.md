# Manual 11 — Conformidade & Proteção de Dados

> **Versão** 1.0.0 · **Data** 2026-07-08 · **Aplica-se a** app 1.0.0 · **Fonte da verdade** · **Classificação: Interno (I)**

---

> ⚠️ **AVISO IMPORTANTE — LER ANTES DE USAR ESTE DOCUMENTO**
>
> Este manual **estrutura e inventaria** o tratamento de dados pessoais da AFROLOC a partir do código-fonte, para servir de base a uma **revisão jurídica**. **Não** constitui parecer jurídico, **não** afirma conformidade legal como facto e **não** substitui a avaliação de um jurista qualificado. Cada secção que envolve juízo legal está marcada com `⚠️ requer validação jurídica`, com referência aos dois regimes candidatos: **RGPD (Regulamento (UE) 2016/679)** e a **Lei de Proteção de Dados Pessoais de Angola (Lei n.º 22/11)**. A determinação de qual regime se aplica, ou de ambos, é ela própria uma questão jurídica em aberto.

---

## 1. Âmbito e aviso

### 1.1. Objetivo
Documentar, de forma ancorada no código, **que dados pessoais** a app AFROLOC recolhe, **para que fins**, **com que retenção**, **que direitos** assistem ao titular e **que mecanismos de segurança** existem — de modo a que um jurista possa validar a conformidade com o(s) regime(s) aplicável(is).

### 1.2. Estado atual (factual)
- Existe uma **Política de Privacidade in-app** em `src/pages/PrivacyPolicy.tsx`. O próprio ficheiro declara, em comentário de cabeçalho, tratar-se de um **"MODELO INICIAL"** que deve ser **"Rever com aconselhamento jurídico antes de produção"**, ajustando às leis aplicáveis (menciona **Lei 22/11 de Angola** e **RGPD**). A página apresenta um banner de rascunho (`privacy_draft_label` / `privacy_draft_notice`) e um contacto `privacy@afroloc.com`.
- O texto da política é servido por chaves de tradução (`t('privacy_*')`) via `LanguageContext`, não como texto fixo.

> ⚠️ **requer validação jurídica** — A Política de Privacidade está explicitamente marcada como rascunho no código. Não deve ser tratada como documento legal vigente enquanto não for validada.

### 1.3. O que este documento **não** faz
- Não emite pareceres sobre licitude, bases legais ou obrigações de notificação.
- Não confirma a existência de RIPD/DPIA, de nomeação de Encarregado de Proteção de Dados (DPO), nem de registo junto de qualquer autoridade de controlo.

---

## 2. Dados pessoais recolhidos

Inventário construído a partir das tabelas e funções do repositório. Todas as tabelas indicadas têm **Row Level Security (RLS) ativa** (ver §6).

### 2.1. Dados de conta e contacto — `public.profiles`
Origem: `supabase/migrations/20251110095655_*.sql`.

| Campo | Tipo | Natureza |
|---|---|---|
| `full_name` | TEXT | Nome do titular |
| `phone` | TEXT | **Número de telefone em texto claro** |
| `afro_id` | TEXT | Identificador AFROLOC do utilizador |
| `user_id` | UUID | Ligação a `auth.users` |

- O **email** é gerido pelo Supabase Auth (`auth.users`), fora desta tabela.
- ⚠️ **Nota técnica importante:** o número de telefone é armazenado **em claro** em `profiles.phone`. O hashing SHA-256 (`sha256Hex`, ver `supabase/functions/send-signup-otp/index.ts`) **não** protege o telefone em repouso — é usado apenas como **chave de rate-limiting** e para deduplicação em `security_events` (`details->>phone_hash`), a par de um mascaramento `phone.substring(0,5) + "***"` nos logs. Ver §6.3.

### 2.2. Endereço e localização precisa — `public.afroloc_records`
Origem: `supabase/migrations/20251110095655_*.sql` (criada como `afroid_records`, renomeada em `20251212023949_*.sql`).

| Campo | Tipo | Natureza |
|---|---|---|
| `geo_lat`, `geo_lon` | NUMERIC | **Coordenadas GPS precisas** do endereço |
| `country`, `level1..level4_code/name` | TEXT | Divisão administrativa |
| `street_name`, `number`, `unit` | TEXT | Morada detalhada |
| `code` | TEXT | Código AFROLOC (endereço) |
| `metadata` | JSONB | Metadados livres (conteúdo a auditar) |

- Localização GPS de um domicílio é, em geral, **dado pessoal** (identifica onde vive uma pessoa).
- ⚠️ **requer validação jurídica** — Verificar se o conteúdo de `metadata` (JSONB) contém categorias adicionais de dados pessoais não inventariadas aqui.

### 2.3. Foto da porta / propriedade + EXIF
Componentes: `src/components/PropertyPhotoCapture.tsx`, `PropertyPhotoDisplay.tsx`; utilitários `src/utils/atsScore.ts`, `gpsSpoofingDetection.ts`, `verificationRisk.ts`, `imageCompressionWorker.ts`.

- A app captura **foto da fachada/porta** e processa metadados de imagem (EXIF) para pontuação anti-spoofing/ATS.
- ⚠️ Uma foto de fachada pode conter **terceiros identificáveis** (pessoas, matrículas) e os EXIF podem conter **geolocalização** e identificadores de dispositivo. `requer validação jurídica`.

### 2.4. Presença contínua — PoDP (`public.podp_samples`)
Origem: `supabase/migrations/20260623190506_*.sql`.

| Campo | Tipo | Natureza |
|---|---|---|
| `geo_lat`, `geo_lon` | DOUBLE PRECISION | **Localização recorrente** do utilizador |
| `accuracy_m`, `distance_from_address_m`, `is_within_radius` | NUMERIC/BOOL | Prova de proximidade ao endereço |
| `captured_at`, `received_at` | TIMESTAMPTZ | Instante da amostra |
| `device_fingerprint` | TEXT | **Impressão digital do dispositivo** |
| `client_generated_id` | TEXT | Identificador do cliente |

- O PoDP (Proof of Daily Presence) recolhe **amostras de localização ao longo do tempo**, agregadas em `podp_daily_rollup`. Trata-se de **rastreio de padrões de presença** — categoria sensível do ponto de vista de privacidade.
- ⚠️ `requer validação jurídica` — A recolha continuada de localização e o `device_fingerprint` exigem base legal e transparência específicas (RGPD art.º 6/9; Lei 22/11).

### 2.5. Documentos de identidade — `public.identity_documents`
Origem: `supabase/migrations/20251110193145_*.sql`.

| Campo | Tipo | Natureza |
|---|---|---|
| `document_type` | TEXT | Tipo de documento (ex.: BI, passaporte) |
| `file_path`, `file_name`, `file_size`, `mime_type` | TEXT/INT | **Ficheiro do documento** (guardado em Supabase Storage) |
| `status` | TEXT | `pending`/`verified`/`rejected` |
| `verified_by_user_id`, `verified_at`, `rejection_reason` | — | Trilho de verificação |

- Os documentos em si residem no **Storage** (o campo `file_path` aponta o objeto); a tabela guarda metadados e o estado.
- ⚠️ Documentos de identidade podem constituir **categorias especiais / dados sensíveis**. `requer validação jurídica` quanto a base legal, minimização e prazos de eliminação.

### 2.6. Metadados técnicos e de segurança
- `security_audit_log` (§6.4): `ip_address`, `user_agent`, `user_id`, `action`, `details` (JSONB).
- `security_events`: eventos de OTP/rate-limit com `phone_hash` e `phone_masked`.
- ⚠️ IP e user-agent são **dados pessoais** sob RGPD. `requer validação jurídica`.

---

## 3. Finalidades e base legal (a validar)

> ⚠️ **requer validação jurídica** — Toda esta secção. As finalidades abaixo são **inferidas do código**; a **base legal** de cada uma (consentimento, execução de contrato, interesse legítimo, obrigação legal) **tem de ser determinada por um jurista** e refletida na Política de Privacidade.

| # | Dados | Finalidade inferida do código | Base legal candidata (A VALIDAR) |
|---|---|---|---|
| 1 | `profiles.phone`, email (Auth) | Registo, autenticação, OTP por SMS | Execução de contrato / Consentimento — **a validar** |
| 2 | `afroloc_records` (GPS + morada) | Criar e localizar endereços AFROLOC | Execução de contrato — **a validar** |
| 3 | Foto da porta + EXIF | Verificação anti-fraude / ATS / anti-spoofing | Interesse legítimo? — **a validar** |
| 4 | `podp_samples` (presença) | Prova de presença diária no endereço | Consentimento explícito? — **a validar** |
| 5 | `identity_documents` | Verificação de identidade | Obrigação legal / Consentimento — **a validar** |
| 6 | IP, user-agent, `security_audit_log` | Segurança, auditoria, anti-abuso | Interesse legítimo / Obrigação legal — **a validar** |

- ⚠️ Confirmar se alguma finalidade envolve **decisões automatizadas** (ex.: `verificationRisk.ts`, `atsScore.ts`) com efeitos sobre o titular — se sim, aplicam-se regras específicas (RGPD art.º 22).

---

## 4. Retenção e minimização

### 4.1. Situação factual
- **Não foi encontrada, nas migrações, uma política de retenção/eliminação automática** (nenhum job de purga por idade para `afroloc_records`, `podp_samples`, `identity_documents` ou `security_audit_log`).
- `ON DELETE CASCADE` liga registos a `auth.users`: **eliminar a conta** elimina em cascata `profiles`, `afroloc_records`, `podp_samples`, `identity_documents`. Isto cobre a eliminação por encerramento de conta, **mas não** define prazos de retenção enquanto a conta existe.
- O PoDP acumula amostras de localização **indefinidamente** salvo purga externa não presente no repositório.

> ⚠️ **requer validação jurídica** — Definir **prazos máximos de retenção** por categoria (especialmente PoDP, documentos de identidade e logs) e implementar eliminação/anonimização automática. A ausência de retenção limitada é um risco de conformidade (princípio da limitação da conservação — RGPD art.º 5/1/e).

### 4.2. Minimização
- Existem práticas parciais de minimização em logs (mascaramento e hash do telefone em `security_events`). Contudo, `profiles.phone` guarda o número **em claro**.
- ⚠️ Avaliar se todos os campos recolhidos são **estritamente necessários** às finalidades (ex.: `device_fingerprint`, `metadata` JSONB, EXIF completo). `requer validação jurídica`.

---

## 5. Direitos do titular

### 5.1. O que o código suporta hoje (factual)
- **Acesso/retificação parcial:** o utilizador vê e edita o próprio `profiles` e os próprios `afroloc_records`/`identity_documents` via políticas RLS (`auth.uid() = user_id`).
- **Eliminação:** o encerramento da conta em `auth.users` propaga `ON DELETE CASCADE` aos dados pessoais ligados.
- **Alteração de telefone:** fluxo dedicado com OTP e notificação (`send-change-phone-otp`, `verify-change-phone-otp`).

### 5.2. Lacunas a confirmar
- ⚠️ **requer validação jurídica e/ou desenvolvimento** — Não foi identificado no repositório um mecanismo formal e completo para: **portabilidade** (exportação estruturada dos dados do titular), **oposição/retirada de consentimento** granular (ex.: desativar PoDP mantendo a conta), e **resposta a pedidos de acesso (DSAR)** com prazos. Confirmar se existem fora do código analisado.

---

## 6. Segurança e audit log

### 6.1. Row Level Security (RLS)
- **RLS ativa** em `profiles`, `afroloc_records`, `podp_samples`, `identity_documents`, `security_audit_log`.
- Regra geral: acesso limitado ao próprio titular (`auth.uid() = user_id`); acessos administrativos por `has_role(...)`.
- `podp_samples` restringe leitura a admin de nível 4 (`podp_is_admin_lvl4()`); escrita reservada a `service_role`.

### 6.2. Controlo de acesso administrativo
- A Edge Function `audit-log` exige papéis explícitos (`admin`, `admin_national`, `admin_province`, `admin_municipality`, `auditor_read`) via `requireRoles(...)` de `_shared/auth_rbac.ts`.

### 6.3. Tratamento do telefone (precisão técnica)
- Em `send-signup-otp/index.ts`: `phoneHash = await sha256Hex(phone)` é usado como **chave de rate-limiting** e deduplicação em `security_events`; nos logs guarda-se `phone_masked` (`phone.substring(0,5) + "***"`).
- ⚠️ **O hash não protege o telefone em repouso** — `profiles.phone` permanece em claro. Avaliar cifra/tokenização se justificado. `requer validação jurídica`.

### 6.4. Audit log — `public.security_audit_log`
- Campos: `user_id`, `action`, `function_name`, `details` (JSONB), `ip_address`, `user_agent`, `created_at`.
- A função `audit-log` (`supabase/functions/audit-log/index.ts`) permite `list`, `stats` e `export` (JSON/CSV), com filtros por ação, utilizador e datas.
- A própria exportação é auditada: `audit(..., "AUDIT_EXPORT", ...)`.
- ⚠️ O audit log contém **dados pessoais** (IP, user-agent, `details`). Sujeitá-lo a prazo de retenção e a controlo de acesso estrito. `requer validação jurídica`.

### 6.5. Transferências e residência dos dados
- Os dados residem em **Supabase** (projeto `ljcxqwjvjgobhisqkujr`, ver `.env` / `supabase/config.toml`). **A região/país do alojamento não está declarada nos ficheiros analisados.**
- ⚠️ **requer validação jurídica** — Determinar o **país de alojamento** e avaliar **transferências internacionais** de dados (ex.: titulares em Angola com dados alojados na UE/EUA, ou vice-versa), incluindo salvaguardas exigidas por RGPD (Cap. V) e pela Lei 22/11.

---

## 7. Checklist para validação jurídica

Itens a submeter a um jurista qualificado. Nenhum está confirmado por este manual.

- [ ] **Regime(s) aplicável(is):** RGPD (UE), Lei 22/11 (Angola), ou ambos — e critério de aplicação territorial.
- [ ] **Política de Privacidade:** rever e aprovar o texto (atualmente marcado como rascunho em `PrivacyPolicy.tsx`) antes de produção.
- [ ] **Base legal por finalidade:** validar as 6 finalidades do §3 (contrato, consentimento, interesse legítimo, obrigação legal).
- [ ] **Consentimento explícito** para PoDP (localização contínua) e para documentos de identidade / categorias especiais.
- [ ] **RIPD/DPIA:** avaliar necessidade de Avaliação de Impacto (localização contínua + fingerprint + documentos = tratamento de alto risco).
- [ ] **Encarregado de Proteção de Dados (DPO):** avaliar obrigatoriedade de nomeação.
- [ ] **Registo/notificação** junto da autoridade de controlo competente (ex.: APD Angola).
- [ ] **Prazos de retenção** por categoria e **implementação de eliminação/anonimização automática** (hoje ausente — §4).
- [ ] **Minimização:** justificar `device_fingerprint`, EXIF completo, `metadata` JSONB, telefone em claro.
- [ ] **Direitos do titular:** implementar/confirmar portabilidade (exportação), retirada de consentimento granular (ex.: desativar PoDP) e processo formal de DSAR com prazos.
- [ ] **Telefone em repouso:** decidir sobre cifra/tokenização de `profiles.phone`.
- [ ] **Retenção do audit log** e de `security_events` (contêm IP/user-agent).
- [ ] **Residência e transferências internacionais:** confirmar região Supabase e salvaguardas de transferência.
- [ ] **Decisões automatizadas:** avaliar `verificationRisk.ts` / `atsScore.ts` face ao RGPD art.º 22.
- [ ] **Subcontratantes:** contratos de tratamento com Supabase, provedor de SMS (Infobip) e serviço de email.
- [ ] **Foto da fachada:** enquadramento de terceiros identificáveis (pessoas/matrículas) e EXIF.
- [ ] **Notificação de violações de dados:** procedimento e prazos.

---

## 8. Changelog

| Versão | Data | Alterações |
|---|---|---|
| 1.0.0 | 2026-07-08 | Versão inicial. Inventário de dados pessoais, finalidades e segurança ancorado no código (tabelas `profiles`, `afroloc_records`, `podp_samples`, `identity_documents`, `security_audit_log`; Edge Function `audit-log`; `PrivacyPolicy.tsx`). Todos os pontos de juízo legal marcados `requer validação jurídica`. |
