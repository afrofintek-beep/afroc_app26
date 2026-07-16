# Manual 4 — Manual do Administrador

| Metadado | Valor |
|---|---|
| **Versão** | 1.0.0 |
| **Data** | 2026-07-08 |
| **Aplica-se a** | app 1.0.0 |
| **Estatuto** | Fonte da verdade |
| **Classificação** | Interno (I) |

> Este manual está ancorado no código do repositório `AFROLOC_source_clean` (ecrãs em `src/pages`, proteção de rotas em `src/components/ProtectedRoute.tsx`, papéis em `src/hooks/useUserRole.ts` e no enum `app_role` de `src/integrations/supabase/types.ts`, e no documento `public/AUTHORIZATION_SYSTEM.md`). Onde não foi possível confirmar um comportamento pelo código, está marcado com `⚠️ a validar`.

---

## 1. Âmbito

Este manual destina-se aos administradores da plataforma AFROLOC e cobre:

- Papéis e níveis de administração e o modelo de autorização.
- Gestão da grelha geoespacial (QG/SQ, torres, cobertura, zonas urbanas).
- Configuração por país (estrutura administrativa, formato do AFRO ID, requisitos de validação).
- Gestão de utilizadores, atribuição de papéis e aprovação de promoções.
- Validação e revisão de documentos e endereços, incluindo campanhas de certificação pela autoridade (mutirão).
- Monitor de segurança (eventos, estatísticas, ameaças ativas).

Fora de âmbito: uso da app pelo cidadão comum (ver Manuais 1–3), especificação do codec (`docs/SPEC_CODEC_AFROLOC.md`) e whitepaper (`docs/01_VISAO_GERAL_WHITEPAPER.md`).

**Nota de segurança operacional:** vários ecrãs administrativos consultam dados diretamente via Supabase e a autorização definitiva é imposta por **RLS** no servidor. A interface esconde/mostra botões, mas a barreira real é a base de dados. Não confiar apenas na UI. `⚠️ a validar` — a cobertura de RLS por tabela não foi auditada neste manual.

---

## 2. Papéis e níveis

### 2.1 Papéis da aplicação (`app_role`)

O enum `app_role` (em `src/integrations/supabase/types.ts`) define os papéis existentes na plataforma:

| Papel | Descrição |
|---|---|
| `admin` | Administrador global. |
| `moderator` | Moderador. |
| `user` | Utilizador genérico. `⚠️ a validar` — relação com `citizen`. |
| `citizen` | Cidadão (utilizador comum da app). |
| `admin_national` | Administrador de nível nacional. |
| `admin_province` | Administrador de nível provincial. |
| `admin_municipality` | Administrador de nível municipal. |
| `operator_field` | Operador de campo. |
| `auditor_read` | Auditor (acesso de leitura). |
| `yamioo_agent` | Agente Yamioo (integração de ecossistema). |

O hook `useUserRole.ts` tipa o papel corrente como `'citizen' | 'admin' | 'moderator' | 'validator' | 'yamioo_agent' | null` e trata como administradores o conjunto `['admin', 'admin_national', 'admin_province', 'admin_municipality']`.

> Nota: o papel `validator` (validador) aparece no tipo do hook mas **não** consta do enum `app_role`. Na prática, o estatuto de validador é determinado pela atribuição de um número em `validation_phone_numbers` e não por um papel em `user_roles`. `⚠️ a validar`.

### 2.2 Proteção de rotas administrativas

O componente `ProtectedRoute` (`src/components/ProtectedRoute.tsx`) protege as rotas:

- Sem sessão → redireciona para `/login`.
- Com `requireAdmin`, consulta a tabela `user_roles` do utilizador e considera-o administrador se possuir um dos papéis `["admin", "admin_national", "admin_province", "admin_municipality"]`. Caso contrário, redireciona para `/dashboard`.

Rotas com `<ProtectedRoute requireAdmin>` (de `src/App.tsx`), relevantes para administração:

| Rota | Ecrã |
|---|---|
| `/grid-management` | Gestão da grelha (GridManagementDashboard) |
| `/admin/country-config` | Configuração de país (AdminCountryConfig) |
| `/admin/user-management` | Gerir utilizadores (AdminUserManagement) |
| `/admin/role-approvals` | Aprovação de papéis (AdminRoleApprovals) |
| `/admin/regional-management` | Gestão regional (AdminRegionalManagement) |
| `/admin/validation-numbers` | Números de validação (AdminValidationNumbers) |
| `/admin/security` | Monitor de segurança (SecurityMonitoring) |
| `/admin/security-audit` | Auditoria de segurança (AdminSecurityAudit) |
| `/admin/import-divisions` | Importar divisões administrativas |
| `/admin/import-urban-zones` | Importar zonas urbanas |
| `/manual-download` | Descarga de manuais |

Rotas relacionadas **sem** `requireAdmin` (protegidas apenas por sessão; a autorização fina é imposta por RLS/lógica interna):

| Rota | Ecrã | Observação |
|---|---|---|
| `/user-levels` | Níveis de utilizador (UserLevels) | apenas sessão |
| `/regional-validation` | Validação regional (RegionalValidation) | apenas sessão |
| `/validators` | Gestão de validadores (ValidatorManagement) | renderização condicional por papel |
| `/certification-kpis` | KPIs de certificação (CertificationKPIs) | `<ProtectedRoute>` sem requireAdmin |
| `/identity/:id/document-verification` | Revisão de documentos (DocumentVerification) | apenas sessão |

`⚠️ a validar` — que os ecrãs sem `requireAdmin` restrinjam a escrita por RLS conforme esperado.

### 2.3 Níveis de autorização do utilizador (1–5)

Independentes dos papéis acima, os **níveis de autorização** (`user_authorization_levels.current_level`, 1–5) medem a confiança do utilizador e são calculados no servidor. Resumo (fonte: `public/AUTHORIZATION_SYSTEM.md`):

| Nível | Nome | Critério essencial | Desbloqueia |
|---|---|---|---|
| 1 | Basic | Conta registada, email verificado | 1 AFRO ID (rascunho) |
| 2 | Verified | 1+ AFRO ID, perfil 100%, endereço válido | até 5 AFRO IDs, pedir testemunhas |
| 3 | Trusted | 2+ testemunhas confirmadas, conta 7+ dias | **pode ser testemunha**, submeter para validação |
| 4 | Certified | 1+ AFRO ID com validação oficial, assinatura de autoridade | prioridade, histórico de validações, pedir papel de moderador |
| 5 | Elite | 3+ AFRO IDs validados, 10+ utilizadores testemunhados, 90+ dias | AFRO IDs ilimitados, analytics avançado, nomear outros |

Os níveis são recalculados por *triggers* no servidor (perfil atualizado, AFRO ID criado/atualizado, testemunha confirmada, validação recebida) e nunca são editáveis pelo cliente. Recalculo manual em massa via edge function `recalculate-authorization-levels`.

**Gestão regional dos níveis:** em `/admin/regional-management` os níveis 1–5 são reinterpretados como camadas de jurisdição (Local, Comunal, Municipal, Provincial, Nacional) e associados a papéis de app (`admin_national`, `admin_province`, `admin_municipality`, `operator_field`) e a uma jurisdição geográfica. Ver secção 5.3.

---

## 3. Gestão da grelha

**Rota:** `/grid-management` · **Ecrã:** `GridManagementDashboard.tsx`

### 3.1 Cabeçalho e seletor de país

- Seletor de país no topo (valores no ecrã: `AO` Angola, `MZ` Moçambique, `ZA` África do Sul, `KE` Quénia, `NG` Nigéria). Predefinição `AO`.
- **Atualizar** (`Atualizar`): recarrega estatísticas.
- **Importar zonas** (`Importar zonas urbanas`): navega para `/admin/import-urban-zones`.
- Feed em tempo real (`useGridRealtime`) com *toasts* de células criadas/aprovadas.

### 3.2 Estatísticas do ciclo de vida da grelha

Painel `GridLifecycleStats` calculado a partir de `afroloc_records` (filtrado por país) e da edge function `urban-zones-status`. Métricas: total de células, urbanas/rurais, alocadas (`approved`/`certified`), pendentes, aprovadas, rejeitadas, número e área (km²) de zonas urbanas, criadas hoje/na semana.

> Nota de código: `avgProcessingTime` está fixado em `24` (mock) e não é calculado a partir de dados reais. `⚠️ a validar`.

### 3.3 Separadores

| Separador | Componente | Função |
|---|---|---|
| Mapa de calor | `ProvinceHeatMap` | Densidade por província |
| Deteção de zonas | `ZoneDetectionMonitor` | Monitorização de deteção urbano/rural |
| Operações em lote | `BatchOperationsPanel` | Processamento em lote por país |
| Estado de alocação | `AllocationStatusTable` | Tabela de alocação de células |
| Configurações | (inline) | Parâmetros da grelha (ver 3.4) |

### 3.4 Parâmetros da grelha (QG/SQ)

No separador **Configurações**, valores exibidos (fixos na UI):

- **Tamanho de célula:** urbana (ZU) **10 m × 10 m**; rural (ZR) **25 m × 25 m**.
- **Subdivisões (SQ):** baixa densidade **2×2**; média densidade **3×3**; alta densidade **4×4**.
- Ações de manutenção: **Exportar configuração** e **Ver grelha** (navega para `/geospatial-grid`).

> Nota: estes valores são apresentados como texto no ecrã de configurações e não há, neste ecrã, um formulário para os alterar. A designação "QG/SQ" corresponde a células/quadrículas e subdivisões (SQ = subdivisão). `⚠️ a validar` — se estes parâmetros são editáveis noutro local (ex.: configuração de país ou base de dados).

### 3.5 Torres e cobertura

A gestão de torres de telecomunicações vive em ecrãs próprios: `/admin/cell-towers` (`AdminCellTowers`) e `/admin/telecom-operators` (`AdminTelecomOperators`), com importação e templates (`public/TELECOM_DATA_REQUEST_TEMPLATE.md`). A cobertura por província é visualizada no mapa de calor da grelha (3.3). `⚠️ a validar` — detalhe operacional destes ecrãs não foi coberto neste manual.

---

## 4. Configuração de país

**Rota:** `/admin/country-config` · **Ecrã:** `AdminCountryConfig.tsx` · Dados via hook `useCountries` (tabela `countries`).

### 4.1 Lista de países

Cada país é um cartão com: nome e código, número de níveis administrativos, estrutura hierárquica (rótulos de nível 1–5), informação territorial (indicativo telefónico, moeda, fuso horário, idiomas) e requisitos de validação. Ações por cartão:

- **Power** (ligar/desligar): alterna `is_active` via `toggleCountryStatus`.
- **Editar** (lápis): abre o diálogo de edição.

Botões de topo: **Importar divisões** (`/admin/import-divisions`) e **Adicionar país**.

### 4.2 Diálogo de criação/edição

O diálogo tem 4 separadores:

**Básico** — `country_code` (2 letras, imutável em edição), `country_name`, `phone_country_code`, `currency`, `timezone`, `is_active`.

**Estrutura** — `admin_levels_count` (1–5) e rótulos `level1_label`…`level4_label`. Predefinições ao criar: 4 níveis, rótulos `Province`, `Territory`, `Commune`, `Quartier`.

**Validação** — `afro_id_format` (variáveis `{COUNTRY}`, `{LEVEL1}`…`{LEVEL4}`, `{NUMBER}`; predefinição `{COUNTRY}-{LEVEL1}-{NUMBER}`); `min_witnesses_required` (1–5, predefinição 2); *switches* `requires_authority_validation` e `requires_witness_validation` (ambos ligados por predefinição).

**Avançado** — `language_codes` (lista separada por vírgulas; predefinição `en`) e `phone_number_format`.

Guardar chama `createCountry` (novo) ou `updateCountry` (edição).

> Estes campos por país determinam diretamente o comportamento de validação da app: nº mínimo de testemunhas, se a validação da autoridade e/ou testemunhas é obrigatória e o formato do identificador. Alterá-los afeta todos os registos futuros desse país.

---

## 5. Utilizadores e roles

### 5.1 Gerir utilizadores

**Rota:** `/admin/user-management` · **Ecrã:** `AdminUserManagement.tsx`

- Tabela paginada (20 por página) de utilizadores, a partir de `profiles`, `user_roles` e `user_authorization_levels`.
- Filtros: papel, nível de autorização, intervalo de datas de registo.
- Exportação: **CSV** e **Excel** dos utilizadores filtrados.
- **Alterar papel** (citizen/moderator/admin) com justificação — verifica jurisdição via RPC `can_promote_user_in_jurisdiction` e regista via RPC `log_role_change`. Promoções para moderator/admin podem passar por `user_role_change_requests` (fila de aprovação).
- **Eliminar conta** com motivo — via edge function `delete-user`.

### 5.2 Aprovação de papéis

**Rota:** `/admin/role-approvals` · **Ecrã:** `AdminRoleApprovals.tsx`

- Tabela de pedidos pendentes (`user_role_change_requests`).
- **Aprovar**: atualiza `user_roles` e regista via `log_role_change`.
- **Rejeitar**: guarda `rejection_reason`.

Fluxo típico: administrador com jurisdição inferior solicita promoção → pedido entra em `user_role_change_requests` (estado `pending`) → administrador competente aprova/rejeita aqui.

### 5.3 Gestão regional (níveis + jurisdição)

**Rota:** `/admin/regional-management` · **Ecrã:** `AdminRegionalManagement.tsx`

- Cinco cartões de contagem, um por nível (N1–N5).
- **Atribuir nível**: escolhe utilizador, nível (N1 Local … N5 Nacional) e jurisdição geográfica em cascata (país → província → município → comuna → bairro), a partir de `countries` e `administrative_divisions`.
- Ao atribuir, é definido `current_level` e os campos de jurisdição em `user_authorization_levels` (`jurisdiction_country`, `jurisdiction_level1_code/name` … `level4`), e são atribuídos os papéis de app correspondentes (`admin_national`, `admin_province`, `admin_municipality`, `operator_field`).

### 5.4 Níveis de utilizador (relatório)

**Rota:** `/user-levels` · **Ecrã:** `UserLevels.tsx`

Página só de leitura: cinco cartões (utilizadores por nível 1–5), tabela com pesquisa e métricas de envolvimento (`afroid_count`, `witness_count`, `validation_count`, `account_age_days`), a partir de `user_authorization_levels` com `profiles`. Sem ações de edição.

---

## 6. Validação e certificação (autoridade/mutirão)

### 6.1 Revisão de documentos

**Rota:** `/identity/:id/document-verification` · **Ecrã:** `DocumentVerification.tsx`

- Gestão de documentos de identidade associados a um AFRO ID: **bilhete de identidade nacional, fatura de serviço, certificado de residência, escritura de propriedade**.
- Estados: `pending` / `uploaded` / `verified` / `rejected` (crachás verde/amarelo/vermelho).
- Ações: carregar/substituir/eliminar documento; pré-visualizar.
- Dados: `afroloc_records` (leitura), `identity_documents` (leitura/inserção/eliminação), bucket de Storage `identity-documents`.

> Nota: este ecrã, tal como está no código, não impõe verificação de papel na UI — a proteção é a sessão + RLS. `⚠️ a validar`.

### 6.2 Validação regional (testemunhas)

**Rota:** `/regional-validation` · **Ecrã:** `RegionalValidation.tsx`

- Grelha de pedidos de validação de testemunha pendentes (código AFROLOC, localização, código OTP, prazos), de `afroloc_witnesses` + `afroloc_records`.
- Cartão de validadores online (canal de presença `validators-presence`, com `user_id`, email, `online_at`, região) e linha temporal de atividade.
- **Aprovar**: estado → `confirmed`, define `confirmed_at`/`validated_at`/`validated_by_user_id`.
- **Rejeitar** (com motivo): estado → `rejected`, guarda `rejection_reason`.
- Subscrições em tempo real e notificações de novos pedidos.

O estatuto de validador é determinado pela atribuição em `validation_phone_numbers` (ver 6.4), não por um papel `app_role`.

### 6.3 KPIs de certificação e campanhas (mutirão)

**Rota:** `/certification-kpis` · **Ecrã:** `CertificationKPIs.tsx`

- Filtros em cascata: país → nível 1 (província) → nível 2 (distrito/município) + período (7/30/90/365 dias).
- KPIs: taxa de aprovação (`verified` + `certified` / total), tempo médio de verificação (horas), precisão de GPS (metros, cálculo Haversine entre GPS do dispositivo e GPS EXIF da foto) e taxa de confirmação de testemunhas.
- Gráficos: tendência de certificação, distribuição de precisão GPS (<10 m / 10–50 m / 50–100 m / >100 m), distribuição por estado; painéis de comparação regional e alertas de métricas.

**Sobre "mutirão" (campanha de certificação pela autoridade):** o código não usa o termo *mutirão* nem expõe um ecrã dedicado de "campanha". Na prática, uma campanha de certificação em massa corresponde a: uma autoridade (validação de GPS/autoridade) processar muitos registos de uma região num curto período, movendo-os para `certified`. Este ecrã de KPIs, com os seus filtros geográficos e por período, é o instrumento para **planear e medir** essas campanhas (taxa de aprovação e tempo médio por região/janela temporal). A validação da autoridade em si acontece nos ecrãs `AuthorityValidation` / `AuthorityGPSValidation` (`⚠️ a validar` — não detalhados neste manual). O termo "mutirão" é uma designação de negócio, não uma etiqueta presente no código.

### 6.4 Números de validação

**Rota:** `/admin/validation-numbers` · **Ecrã:** `AdminValidationNumbers.tsx`

- Pré-alocação e gestão de números de telefone de validação por região administrativa (mecanismo anti-fraude, para evitar spoofing de validação).
- Ações: **criar/editar/eliminar** número (telefone, país, divisão administrativa, estado, ativo).
- Estados de verificação: `verified` / `pending` / `suspended`.
- Mostra contagem de utilizações, última utilização e estado ativo. Números agrupados por país.
- Dados: `validation_phone_numbers`, `administrative_divisions`.

Gestão avançada e estatísticas de validadores estão também em `/validators` (`ValidatorManagement.tsx`): separadores Criar / Lista / Estatísticas / Analytics, com atribuição de validadores e gráficos de desempenho regional.

---

## 7. Monitor de segurança

**Rota:** `/admin/security` · **Ecrã:** `SecurityMonitoring.tsx`

Três separadores:

1. **Eventos** — lista filtrável de eventos de segurança (IP, endpoint, timestamp, detalhes, notas de resolução). Filtros por severidade (`low`/`medium`/`high`/`critical`), tipo de evento e estado de resolução; pesquisa por IP/endpoint/ID de utilizador. Ação: **resolver evento** com nota (atualiza `resolved`/`resolved_at`/notas em `security_events`).
2. **Estatísticas** — agregados por tipo/severidade (IPs e utilizadores únicos), via RPC `get_security_stats(p_start_date, p_end_date)`.
3. **Ameaças ativas** — tentativas de força-bruta detetadas (contagem de tentativas falhadas, utilizadores visados), via RPC `detect_brute_force_attempts()`.

Subscrições em tempo real sobre `security_events`. Ecrã complementar de auditoria em `/admin/security-audit` (`AdminSecurityAudit`).

---

## 8. Problemas conhecidos

Relativos à página de descarga de documentação (**`/manual-download`**, ecrã `ManualDownload.tsx`, protegida com `requireAdmin`):

1. **Botão "Ver" abre o `.md` cru — a corrigir.** O botão **Ver** chama `handleViewOnline`, que faz `window.open(doc.path, '_blank')`. Isto abre o ficheiro Markdown em bruto (texto não renderizado) numa nova aba, em vez de mostrar o conteúdo formatado. **A corrigir** — renderizar o Markdown num visualizador (ou converter para HTML) antes de abrir.

2. **`MANUAL_DE_APOIO.md` em falta → 404 — a corrigir.** O primeiro documento da lista aponta para `path: "/MANUAL_DE_APOIO.md"` (`filename: "MANUAL_DE_APOIO.md"`), mas o ficheiro **não existe** em `public/` (confirmado: `public/MANUAL_DE_APOIO.md` não encontrado). Por isso o `fetch`/`window.open` devolve 404 e o download/visualização falha. Nota relacionada: a pasta `docs/` (onde vive este manual) está **untracked** no git — não é servida como estático nem publicada. **A corrigir** — criar/publicar `public/MANUAL_DE_APOIO.md` (ou corrigir o caminho) e versionar `docs/`.

> Os restantes documentos referenciados (`HIERARCHICAL_SYSTEM.md`, `AUTHORIZATION_SYSTEM.md`, `CAMERA_PERMISSIONS.md`, `TRANSLATION_VALIDATION.md`, `AFROLOC_DOCUMENTACAO_COMPLETA.md`) existem em `public/` e funcionam.

Outras notas menores de código, marcadas ao longo do manual como `⚠️ a validar`: `avgProcessingTime` fixado em 24 no dashboard da grelha; papel `validator` no tipo do hook sem correspondência no enum `app_role`; ecrãs sem `requireAdmin` dependentes de RLS não auditada.

---

## 9. Changelog

| Versão | Data | Alterações |
|---|---|---|
| 1.0.0 | 2026-07-08 | Versão inicial do Manual do Administrador, ancorada em `src/pages` (grelha, país, utilizadores/roles, validação/certificação, segurança), `ProtectedRoute` e `AUTHORIZATION_SYSTEM.md`. |
