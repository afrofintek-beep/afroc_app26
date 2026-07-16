# Manual 7 — Referência de API (Edge Functions)

| Metadado | Valor |
|---|---|
| **Versão** | 1.0.0 |
| **Data** | 2026-07-08 |
| **Aplica-se a** | app 1.0.0 |
| **Estatuto** | Fonte da verdade |
| **Classificação** | Interno (I) |

> Este documento é **ancorado no código-fonte**. Os contratos de request/response abaixo foram extraídos de `supabase/functions/`. Onde um valor não pôde ser confirmado a partir do código, está marcado com `⚠️ a validar`. **Não inventar payloads** — validar sempre contra o ficheiro indicado.

---

## 1. Âmbito

Este manual descreve o contrato das principais APIs (Edge Functions Supabase / Deno) da AFROLOC 1.0.0, com foco em:

- **`address-gateway`** — camada de integração unificada para operações de morada (criar, verificar, certificar, consultar, listar, validar, descodificar, eliminar). Documentado por *action* na Secção 3.
- **`api-v1`** — API REST pública com routing por caminho (`/addresses`, `/scores`, `/validations`, `/otp`, `/users`, `/zones`, `/partners`). Secção 4.
- **`v1-docs`** — biblioteca de documentos com verificação de integridade (SHA-256). Secção 4.
- Um **catálogo** das restantes Edge Functions por categoria (Secção 5).

Cobre ainda: autenticação (JWT / service role / anon key / partner key), formato de request/response, e códigos de erro (Secção 6).

**Base URL** (todas as funções): `${SUPABASE_URL}/functions/v1/<nome-da-função>`.

Ficheiros-fonte principais:
- `supabase/functions/address-gateway/index.ts`
- `supabase/functions/api-v1/index.ts`
- `supabase/functions/v1-docs/index.ts`
- `supabase/functions/_shared/auth_rbac.ts` (autenticação, RBAC, CORS partilhados)

---

## 2. Autenticação

### 2.1 Mecanismos

| Mecanismo | Cabeçalho | Uso |
|---|---|---|
| **JWT de utilizador** | `Authorization: Bearer <access_token>` | Chamadas de utilizador autenticado. Validado por `supabase.auth.getUser(token)`. |
| **Anon key** | `Authorization: Bearer <SUPABASE_ANON_KEY>` | Chamadas função→função para engines públicas (qg-engine, sq-engine, normalize, resolve-zone) e ações públicas. |
| **Service role key** | `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` | Interno. O `address-gateway` e a `api-v1` criam o cliente Supabase com esta chave para bypass de RLS; a autorização é aplicada **em código** (ver 2.3). Usada também para chamar `ats-engine`. |
| **Partner key** | `x-partner-key: <YAMILOOK_PARTNER_KEY>` | Endpoint de parceiro `api-v1 POST /partners/certification-status` (ex.: Yamilook). **Não** usa JWT de utilizador. |

> Nota: o cliente Supabase interno é sempre construído com a **service role key** (`SUPABASE_SERVICE_ROLE_KEY`). Isto significa que a RLS não protege estas funções — a segurança depende inteiramente da lógica de autorização em código descrita abaixo. Fonte: `address-gateway/index.ts:826-828`, `api-v1/index.ts:591-593`.

### 2.2 Papéis (roles)

Os papéis são lidos da tabela `user_roles` (`select role where user_id = <uid>`).

- **Admin** (`api-v1`): `admin`, `admin_national`, `admin_province`, `admin_municipality` — ver `requireAdmin` (`api-v1/index.ts:100-106`).
- **Validador** (`address-gateway`, ação `certify`): `admin`, `admin_national`, `admin_regional`, `validator`, `authority` — ver `isValidator` (`address-gateway/index.ts:857-859`).
- **Admin para `delete`** (`address-gateway`): `admin`, `admin_national` (`address-gateway/index.ts:720`).
- Helpers RBAC partilhados (`_shared/auth_rbac.ts`): `isAdmin`, `isAuditor` (`auditor_read`), `isOperator` (`operator_field`), `hasAnyRole`, `requireRoles`.

### 2.3 Regra por função

| Função | Exige JWT? | Notas |
|---|---|---|
| `address-gateway` | **Sim, sempre** | Todas as ações exigem `Bearer <JWT>` válido (401 caso contrário). `create` força `userId = user.id`; `certify` exige papel de validador (403); `delete` re-valida o JWT e aplica dono/admin. |
| `api-v1` | **Depende da rota** | Alguns `GET` de `/addresses` e os `POST /addresses/{decode,normalize,validate-code}` e `/partners/*` não exigem JWT; `create`, `verify`, `scores`, `validations`, `users` exigem. |
| `v1-docs` | **Opcional** | `list`/`get`/`download` respeitam `visibility` (public/restricted/private); `upload`/`delete` exigem `admin`. |

### 2.4 CORS

Definido em `_shared/auth_rbac.ts`. Os `corsHeaders` estáticos usam `Access-Control-Allow-Origin: *`. Existe também `getCorsHeaders(req)` (dinâmico) que restringe a origens permitidas (`afroloc.com`, `afroloc.ao`, Vercel de produção/preview, `localhost`) e acrescenta cabeçalhos de segurança (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, etc.). Cabeçalhos aceites incluem `authorization, apikey, content-type, x-afroloc-partner-key`.

---

## 3. `address-gateway`

**Ficheiro:** `supabase/functions/address-gateway/index.ts`
**Método HTTP:** `POST` (único). O corpo JSON contém sempre um campo `action` que seleciona a operação.
**Autenticação:** obrigatória — `Authorization: Bearer <JWT de utilizador>` em **todas** as ações. Sem cabeçalho válido → `401`.

### 3.1 Envelope de resposta

Todas as respostas seguem o envelope `GatewayResponse` (`index.ts:100-106`):

```json
{
  "success": true,
  "data": { "...": "resultado específico da action" },
  "requestId": "REQ-<timestamp>-<rand>",
  "timestamp": "2026-07-08T12:00:00.000Z"
}
```

Em erro:

```json
{
  "success": false,
  "error": "<mensagem>",
  "requestId": "REQ-...",
  "timestamp": "..."
}
```

Códigos de estado: `200` sucesso; `401` sem JWT / token inválido; `403` falta de papel (só `certify`); `400` para qualquer erro lançado pelos handlers (inclui validações de domínio e "not found"). Ver Secção 6.

Cada pedido gera um `requestId` (`REQ-${Date.now()}-${rand}`) e é registado em `security_audit_log` como `gateway_<action>` (`logAudit`, `index.ts:793-815`).

### 3.2 Ordem de processamento (todas as ações)

1. `OPTIONS` → resposta CORS vazia.
2. Cria cliente Supabase com **service role key**.
3. Lê o corpo JSON.
4. **Auth**: exige `Bearer` + `getUser(token)`; senão `401`.
5. Carrega `user_roles` e calcula `isValidator`.
6. `switch(request.action)` → handler.
7. `logAudit(...)` + resposta.

---

### 3.3 `action: "create"`

Cria uma nova morada com códigos QG/SQ e calcula ATS inicial. Handler `handleCreate` (`index.ts:270-380`).

**Request:**

```json
{
  "action": "create",
  "latitude": -8.8383,
  "longitude": 13.2344,
  "countryCode": "AO",
  "userId": "<ignorado — forçado ao JWT>",
  "addressDetails": {
    "level1Code": "...", "level1Name": "...",
    "level2Code": "...", "level2Name": "...",
    "level3Code": "...", "level3Name": "...",
    "level4Code": "...", "level4Name": "...",
    "streetName": "...", "number": "...", "unit": "...",
    "propertyType": "..."
  },
  "photoMetadata": {
    "exifLat": -8.8383, "exifLon": 13.2344,
    "exifTimestamp": "...", "deviceMake": "...", "deviceModel": "..."
  }
}
```

Notas:
- `userId` do cliente é **ignorado**; o router força `request.userId = user.id` (`index.ts:867`). Nunca se confia no id fornecido.
- Aceita `addressDetails` aninhado **ou** os mesmos campos "achatados" na raiz (`index.ts:277-291`). Campo `address_type`/`addressType` é opcional; se ausente, um trigger da BD deriva o tipo.
- `photoMetadata` é opcional.
- `countryCode` tem de ser um país africano (lista de 54 ISO-2 em `validateAfricanCountry`, `index.ts:118-128`); senão erro `Country must be within Africa`.

**Fluxo interno:** chama `qg-engine` (código de grelha) → `sq-engine` (subdivisão) → conta registos com prefixo `sqResult.fullCode` para gerar sequência → insere em `afroloc_records` com `status: 'draft'` → chama `ats-engine` para ATS inicial.

**Response `data`:**

```json
{
  "afrolocCode": "<fullCode>-0001",
  "recordId": "<uuid>",
  "qgCode": "...",
  "sqCode": "...",
  "fullCode": "...",
  "cellType": "urban|rural",
  "subdivisionType": "...",
  "bounds": { "...": "subCellBounds" },
  "atsScore": { "...": "objeto do ats-engine" },
  "certificationLevel": { "...": "objeto do ats-engine" }
}
```

**Erros:** `Country must be within Africa`; `QG Engine error: ...`; `SQ Engine error: ...`; `Failed to create record: <msg>`; `ATS Engine error: ...`. Todos devolvem `400`.

---

### 3.4 `action: "verify"`

Verifica se a posição atual do utilizador está dentro do limiar da morada registada. Handler `handleVerify` (`index.ts:385-430`).

**Request:**

```json
{
  "action": "verify",
  "afroidCode": "<código AFROLOC>",
  "verificationData": {
    "currentLatitude": -8.8383,
    "currentLongitude": 13.2344,
    "witnessIds": ["<uuid>", "..."]
  }
}
```

`witnessIds` é opcional (declarado na interface; não é usado no cálculo de distância neste handler — `⚠️ a validar` o seu efeito).

**Fluxo:** procura registo por `code = afroidCode` (erro `Address not found` se não existir) → calcula distância euclidiana aproximada (`Δlat/Δlon × 111000` m) → limiar `100 m` (urbano) ou `500 m` (rural), conforme `metadata.cellType` → recalcula ATS.

**Response `data`:**

```json
{
  "verified": true,
  "distanceMeters": 42.7,
  "threshold": 100,
  "record": { "code": "...", "country": "AO", "status": "draft", "createdAt": "..." },
  "atsScore": { "...": "..." },
  "certificationLevel": { "...": "..." }
}
```

**Erros:** `Address not found`; `ATS Engine error`. (`400`.)

---

### 3.5 `action: "certify"`

Cria um registo de validação/certificação para uma morada, sujeito ao ATS. Handler `handleCertify` (`index.ts:435-505`).
**Autorização:** exige papel de validador (`admin`, `admin_national`, `admin_regional`, `validator`, `authority`); caso contrário `403 Forbidden: validator role required`.

**Request:**

```json
{
  "action": "certify",
  "afroidRecordId": "<uuid do registo>",
  "certificationLevel": 3,
  "validatorId": "<ignorado — forçado ao JWT>",
  "notes": "texto opcional"
}
```

- `certificationLevel` inteiro `1..4`; fora do intervalo → `Certification level must be between 1 and 4`.
- `validatorId` do cliente é **ignorado**; o router força `request.validatorId = user.id` (`index.ts:880`).

**Fluxo:** obtém registo por `id` (senão `Record not found`) → chama `ats-engine`; se `atsResult.certificationLevel.level < certificationLevel`, rejeita com mensagem de score insuficiente → insere em `afroloc_validations` (`validation_method = certification_level_<n>`, `authority_role = certified_validator`, `expires_at` = +1 ano) → atualiza `afroloc_records.status` para `certified` (nível ≥ 3) ou `verified` (< 3), preenchendo `approved_at`, `approved_by_user_id`, `last_verified_at`.

**Response `data`:**

```json
{
  "certified": true,
  "validationId": "<uuid>",
  "newStatus": "certified",
  "certificationLevel": 3,
  "expiresAt": "2027-07-08T...",
  "atsScore": { "...": "..." }
}
```

**Erros:** `403` (papel); `Certification level must be between 1 and 4`; `Record not found`; `ATS score (...) is too low for certification level ...`; `Failed to create validation: <msg>`. (`400`.)

---

### 3.6 `action: "lookup"`

Consulta moradas por código, por código QG, ou por coordenadas. Handler `handleLookup` (`index.ts:510-592`). Aceita **um** de três modos:

**(a) Por código AFROLOC** — `{ "action": "lookup", "code": "<AFROLOC>" }`
Retorna registo completo + ATS. Se não existir → `Address not found`.
```json
{ "record": { "...": "linha completa" }, "atsScore": {...}, "certificationLevel": {...} }
```

**(b) Por código QG** — `{ "action": "lookup", "qgCode": "<QG>" }`
Retorna todas as moradas na célula (prefixo `like qgCode%`, limite 100).
```json
{ "count": 12, "records": [ { "code": "...", "status": "...", "createdAt": "..." } ] }
```

**(c) Por coordenadas** — `{ "action": "lookup", "latitude": -8.83, "longitude": 13.23 }`
Procura numa "caixa" de ±0.01° (≈1 km), ordena por distância, devolve as 5 mais próximas.
```json
{ "count": 3, "nearest": { "...": "registo + distanceMeters" },
  "records": [ { "code": "...", "distanceMeters": 12.3, "status": "..." } ] }
```

**Erros:** `Address not found` (modo a); `Lookup failed: <msg>`; se nenhum critério fornecido → `Lookup requires code, qgCode, or latitude/longitude`. (`400`.)

---

### 3.7 `action: "list"`

Lista moradas com coordenadas, para demo pública. Handler `handleList` (`index.ts:597-623`).

**Request:** `{ "action": "list", "countryCode": "AO", "limit": 50 }`
`countryCode` opcional (filtra por `country`); `limit` opcional (default `50`). Só devolve registos com `geo_lat`/`geo_lon` não nulos.

**Response `data`:**
```json
{
  "count": 50,
  "records": [ {
    "id": "...", "code": "...", "country": "AO",
    "level1_name": "...", "level2_name": "...", "level3_name": "...", "level4_name": "...",
    "street_name": "...", "number": "...", "property_type": "...",
    "geo_lat": -8.83, "geo_lon": 13.23, "status": "...", "address_type": "..."
  } ]
}
```

**Erros:** `List failed: <msg>`.

---

### 3.8 `action: "validate"`

Valida e (se aplicável) converte um código AFROLOC legado, via `qg-engine`. Handler `handleValidate` (`index.ts:628-644`).

**Request:** `{ "action": "validate", "code": "<código>" }`

**Response `data`:**
```json
{
  "valid": true,
  "normalizedCode": "...",
  "wasConverted": false,
  "originalFormat": "...",
  "error": null
}
```
(Os valores vêm de `qg-engine` com `{ action: 'validate', code }`. `⚠️ a validar` o contrato exato do `qg-engine`.)

**Erros:** `QG Engine validation error: <msg>`.

---

### 3.9 `action: "decode"`

Descodifica um código para dados geográficos, via `qg-engine`. Handler `handleDecode` (`index.ts:649-668`).

**Request:** `{ "action": "decode", "code": "<código>" }`

**Response `data`:**
```json
{
  "afroloc": "...",
  "country": "AO",
  "zone": "...",
  "gridSize": 10,
  "bbox": [ "..." ],
  "centroid": { "lat": -8.83, "lon": 13.23 },
  "wasConverted": false,
  "originalFormat": "..."
}
```
(`gridSize` mapeia de `decoded.grid_m`; `bbox`/`centroid` conforme `qg-engine`. `⚠️ a validar` os campos exatos do `qg-engine`.)

**Erros:** `QG Engine decode error: <msg>`.

---

### 3.10 `action: "delete"`

Elimina uma morada e as suas dependências. Handler `handleDelete` (`index.ts:675-788`).
**Autorização (dupla verificação):** o handler **re-lê e re-valida o JWT** internamente (`Authorization required to delete records` / `Invalid or expired token`).

- **Admin** (`admin`, `admin_national`) → pode eliminar qualquer registo.
- **Dono** → só pode eliminar registos com `status = 'draft'`. Dono de registo não-draft → `Only draft records can be deleted by the owner. Current status: <status>`.
- Nenhum dos casos → `You do not have permission to delete this record`.

**Request:** `{ "action": "delete", "recordId": "<uuid>" }` **ou** `{ "action": "delete", "code": "<AFROLOC>" }`
Sem nenhum → `Delete requires recordId or code`. Se não encontrado → `Record not found`.

**Fluxo:** apaga manualmente registos dependentes (11 tabelas: `witness_contract_downloads`, `identity_documents`, `afroloc_delivery_points`, `afroloc_witnesses`, `afroloc_validations`, `afroloc_checkins`, `afroloc_gps_history`, `afroloc_record_versions`, `afroloc_residence_config`, `afroloc_residents`, `witness_reputation_history`) → aplica `SET NULL` em `afroloc_requests`, `violation_events`, `witness_fraud_flags`, `afroloc_resident_audit_log` → apaga o registo principal → grava audit log.

**Response `data`:**
```json
{ "deleted": true, "recordId": "<uuid>", "code": "<AFROLOC>", "deletedBy": "admin|owner" }
```

**Erros:** `Authorization required to delete records`; `Invalid or expired token`; `Record not found`; `Delete requires recordId or code`; erros de permissão acima; `Failed to delete record: <msg>`. (`400`.)

---

## 4. Outras APIs relevantes

### 4.1 `api-v1` — API REST pública

**Ficheiro:** `supabase/functions/api-v1/index.ts`. Routing por caminho: `/functions/v1/api-v1/<recurso>/<sub>/<param>`.

**Envelope de resposta** (`ApiResponse`, `index.ts:43-69`):
```json
{ "success": true, "data": {...}, "error": undefined,
  "requestId": "REQ-...", "timestamp": "...",
  "pagination": { "page": 1, "limit": 20, "total": 120 } }
```
Em erro, `error` traz a string e `data` fica `undefined`. `success = status < 400`.

**Endpoints** (extraídos do router `index.ts:578-744`):

| Método & rota | Auth | Handler | Notas |
|---|---|---|---|
| `GET /` | — | inline | Info/health da API. |
| `GET /addresses?code=` | — | `handleAddressesGet` | Lookup por código; `404` se não existir. |
| `GET /addresses?lat=&lon=&radius=` | — | `handleAddressesGet` | Procura por raio (default `0.005`≈500 m), ordena por distância. |
| `GET /addresses?country=&page=&limit=` | — | `handleAddressesGet` | Lista paginada (limit máx. 100). |
| `POST /addresses` | **JWT** | `handleAddressCreate` | Exige `latitude`,`longitude`,`countryCode`. `201`. Cria via qg/sq-engine, `status: draft`. |
| `POST /addresses/verify` | **JWT** | `handleAddressVerify` | Exige `afrolocCode`,`latitude`,`longitude`. Distância **Haversine**; limiar 100/500 m. Atualiza `last_verified_at` se verificado. |
| `POST /addresses/decode` | — | `handleAddressDecode` | Proxy p/ `qg-engine` (`{ code }`). |
| `POST /addresses/normalize` | — | `handleAddressNormalize` | Proxy p/ `normalize`. |
| `POST /addresses/validate-code` | — | inline | Proxy p/ `qg-engine` (`{ action:'validate', code }`). |
| `GET /scores/ats/:recordId` | **JWT** | `handleATSGet` | Proxy p/ `ats-engine` (service key). |
| `POST /scores/ats` | **JWT** | `handleATSScore` | Body `afrolocRecordId`/`recordId` e/ou `afrolocCode`. |
| `GET /validations/:recordId` | **JWT** | `handleValidationsGet` | Lista validações do registo. |
| `POST /validations/certify` | **JWT + admin** | `handleCertify` | Exige `recordId`,`level` (1-4). `201`. Requer papel admin (`requireAdmin`). |
| `POST /otp/send` | — | `handleOTPSend` | Body `phone` (ex. `+244923XXXXXX`). Proxy p/ `send-signup-otp`. |
| `POST /otp/verify` | — | `handleOTPVerify` | Body `phone`,`otp_code`. Proxy p/ `verify-signup-otp`. |
| `GET /users/me` | **JWT** | `handleUsersMe` | Perfil + papéis + `user_authorization_levels`. |
| `GET /users` | **JWT + admin** | `handleUsersList` | Lista paginada com `search` (nome/telefone). |
| `GET /users/:id` | **JWT + admin** | inline | Perfil por id; `404` se não existir. |
| `POST /zones/resolve` | — | `handleZoneResolve` | Proxy p/ `resolve-zone`. |
| `POST /partners/certification-status` | **partner-key** | `handlePartnerCertificationStatus` | Header `x-partner-key = YAMILOOK_PARTNER_KEY`. Body `phone`. Devolve se o dono desse telefone tem morada AFROLOC certificada, sem expor dados pessoais. |

**Nota de segurança do endpoint de parceiro** (`index.ts:536-576`): valida `x-partner-key` contra `YAMILOOK_PARTNER_KEY` (401 se inválida); faz *match* pelos últimos 9 dígitos do telefone; devolve `{ certified: false, reason: 'no_afroloc_account' | 'no_certified_address' }` ou `{ certified: true, code, status }`.

**Códigos de erro `api-v1`:** `400` (campos em falta), `401` (auth em falta / token inválido), `403` (admin em falta), `404` (não encontrado / rota inexistente), `500` (erro interno / falha de query), `502` (falha de engine a montante — qg/sq/ats/normalize/resolve-zone).

### 4.2 `v1-docs` — Biblioteca de documentos

**Ficheiro:** `supabase/functions/v1-docs/index.ts`. Ação via query string `?action=...`. Tabela `documents` + bucket de storage `document-library`. JWT opcional (afeta que `visibility` se pode ver: público / restrito / privado).

| `action` | Método | Auth | Efeito |
|---|---|---|---|
| `list` (default) | GET | opcional | Lista docs; filtros `category`,`language`,`visibility`. Anónimo só vê `public`; user não-admin vê `public`+`restricted`; admin vê tudo. |
| `get` | GET | conforme visibilidade | Doc único por `id`. `restricted`→401 sem auth; `private`→403 sem admin. |
| `verify` | GET | — | Recalcula SHA-256 do ficheiro e compara com `documents.sha256` → `integrity_valid`. |
| `download` | GET | conforme visibilidade | Devolve o ficheiro (`Content-Disposition: attachment`). |
| `upload` | POST | **admin** | `multipart/form-data`: `file`,`title`,`category`,`language`,`version`,`visibility`. Calcula SHA-256, guarda no bucket, cria registo. `201`. |
| `delete` | POST/GET | **admin** | Remove ficheiro do storage + registo. |

**Envelope:** `{ success, data?, error?, count? }`. Erros: `400` (id/campos em falta), `401` (auth p/ restricted), `403` (admin p/ private/upload/delete), `404` (não encontrado), `405` (método errado no upload), `500` (falha storage/interno).

---

## 5. Catálogo de funções (Edge Functions)

Índice de `supabase/functions/` (uma linha cada). Contratos detalhados destas funções `⚠️ a validar` no respetivo `index.ts` quando necessário.

### Engines de codificação / geo
| Função | Descrição |
|---|---|
| `qg-engine` | Motor QG: coordenadas → código de grelha; também `validate`/`decode` de códigos. |
| `sq-engine` | Motor SQ: subdivisão de célula QG em subcódigo por densidade. |
| `resolve-zone` | Resolve se coordenada é zona urbana/rural. |
| `normalize` | Normaliza texto de morada. |
| `format` | Formatação de morada/código. |
| `validate` | Validação de códigos/dados. |
| `import-urban-zones` / `urban-zones-status` / `urban-zones-clear` | Gestão de zonas urbanas (importar/estado/limpar). |
| `import-cell-towers` / `import-opencellid` | Importação de torres de telecomunicações. |
| `telecom-fusion` / `mobility-api` | Fusão de sinais telecom / API de mobilidade. |
| `sync-places` | Sincronização de locais/POIs. |

### Moradas / ATS / validação
| Função | Descrição |
|---|---|
| `address-gateway` | **Gateway principal** (Secção 3). |
| `address-create` / `address-verify` | Criação / verificação de morada (endpoints diretos, precursores do gateway). |
| `ats-engine` / `ats-score` | Cálculo do Address Trust Score. |
| `recalculate-authorization-levels` | Recalcula níveis de autorização de utilizadores. |
| `batch-assign-qgsq` / `batch-resolve` | Atribuição/resolução QG-SQ em lote. |
| `assign-afroloc-request` / `receive-afroloc-request` / `complete-afroloc-request` | Fluxo de pedidos de atribuição de AFROLOC. |
| `lookup-requester` / `notify-requester-validation` | Consulta / notificação de requerentes. |

### Entregas (delivery)
| Função | Descrição |
|---|---|
| `delivery-register` / `delivery-confirm` / `delivery-list` / `delivery-revoke` / `delivery-set-primary` | Ciclo de pontos de entrega associados a uma morada. |

### Testemunhas (witnesses) / residentes
| Função | Descrição |
|---|---|
| `send-witness-otp` / `verify-witness-otp` / `receive-witness-sms` | OTP/SMS de testemunhas. |
| `notify-witness-contract-download` | Notifica descarga de contrato de testemunha. |
| `resident-checkin` | Check-in de residente numa morada. |

### Autenticação / OTP / 2FA / biometria
| Função | Descrição |
|---|---|
| `auth` | Endpoint de autenticação. |
| `send-signup-otp` / `verify-signup-otp` / `validate-signup` | OTP e validação de registo. |
| `phone-login` / `biometric-login` | Login por telefone / biometria. |
| `send-change-phone-otp` / `verify-change-phone-otp` | Mudança de telefone com OTP. |
| `send-admin-2fa` / `verify-admin-2fa` | 2FA de administradores. |
| `generate-backup-codes` / `verify-backup-code` | Códigos de recuperação. |
| `register-biometric-device` / `webauthn-register-options` / `webauthn-register-verify` | Registo WebAuthn / dispositivo biométrico. |
| `cleanup-expired-otps` | Limpeza de OTPs expirados (cron). |

### Administração / utilizadores
| Função | Descrição |
|---|---|
| `admin-users` / `delete-user` | Gestão / eliminação de utilizadores (admin). |
| `audit-log` | Consulta do registo de auditoria. |
| `test-auth-rbac` | Teste de autenticação/RBAC. |
| `translate-keys` | Tradução de chaves i18n. |

### PoDP (Proof of Daily Presence)
| Função | Descrição |
|---|---|
| `podp-sample` / `podp-rollup` / `podp-admin` | Amostragem / agregação diária / administração do PoDP. |

### KPIs / exportação / relatórios
| Função | Descrição |
|---|---|
| `kpis-summary-csv` / `kpis-by-province-csv` / `kpis-by-admin-csv` / `kpis-growth-csv` / `kpis-timeseries-csv` | Exportação de KPIs em CSV. |
| `csv-export` / `export-geojson` | Exportação genérica CSV / GeoJSON. |
| `send-weekly-analytics-report` | Relatório semanal de analítica. |
| `archive-gps-history` | Arquivo do histórico GPS. |

### Notificações / e-mail / risco
| Função | Descrição |
|---|---|
| `send-push-notification` | Notificações push. |
| `send-contact-email` / `send-document-status-email` / `send-validation-reminder` | E-mails transacionais. |
| `send-fraud-alert-email` / `send-risk-alert` / `check-risk-alerts` | Alertas de fraude/risco. |

### Integrações / webhooks / documentos
| Função | Descrição |
|---|---|
| `api-v1` | **API REST pública** (Secção 4.1). |
| `v1-docs` | **Biblioteca de documentos** (Secção 4.2). |
| `yamioo-gateway` / `manage-yamioo-agents` | Integração com o ecossistema Yamioo. |
| `receive-webhook` / `webhook-dispatch` | Receção / despacho de webhooks. |
| `get-mapbox-token` | Emissão de token Mapbox. |
| `download-source` | Descarga de código-fonte (proteção de IP). |
| `seed-test-data` | Semear dados de teste. |

---

## 6. Códigos de erro

### 6.1 Estados HTTP

| Código | Significado | Onde |
|---|---|---|
| `200` | OK | Todas. |
| `201` | Criado | `api-v1` create/certify; `v1-docs` upload. |
| `400` | Bad Request — validação, "not found" lançado, ação desconhecida | `address-gateway` (qualquer erro no `catch`), `api-v1`, `v1-docs`. |
| `401` | Não autenticado — falta `Bearer` ou token inválido/expirado | Todas as funções com auth. |
| `403` | Proibido — falta de papel (validador/admin) | `address-gateway` (`certify`), `api-v1` (admin), `v1-docs` (private/admin). |
| `404` | Não encontrado — recurso ou rota | `api-v1`, `v1-docs`. |
| `405` | Método não permitido | `v1-docs` upload (exige POST). |
| `500` | Erro interno / falha de query | `api-v1`, `v1-docs`. |
| `502` | Falha de engine a montante (qg/sq/ats/normalize/zone) | `api-v1`. |

> Atenção: o `address-gateway` devolve `400` para praticamente **todos** os erros de handler (incluindo "not found" e falhas de engine), porque o `catch` global usa `status: 400` (`index.ts:929-932`). Só `401`/`403` são devolvidos antes de chegar ao handler.

### 6.2 Mensagens de erro por origem (extraídas do código)

**`address-gateway`:**
`Unauthorized` (401) · `Invalid or expired token` (401) · `Forbidden: validator role required` (403) · `Country must be within Africa` · `QG/SQ/ATS Engine error: ...` · `Failed to create record: ...` · `Address not found` · `Certification level must be between 1 and 4` · `Record not found` · `ATS score (...) is too low for certification level ...` · `Failed to create validation: ...` · `Lookup requires code, qgCode, or latitude/longitude` · `List failed: ...` · `Authorization required to delete records` · `Only draft records can be deleted by the owner. Current status: ...` · `You do not have permission to delete this record` · `Delete requires recordId or code` · `Failed to delete record: ...` · `Unknown action: ...`.

**`api-v1`:**
`Authentication required. Provide a Bearer token.` (401) · `Forbidden. Admin role required.` (403) · `Address not found` (404) · `latitude, longitude, and countryCode are required` (400) · `afrolocCode, latitude, and longitude are required` (400) · `recordId and level (1-4) are required` (400) · `Invalid partner key` (401) · `Route not found: ...` (404) · `QG Engine error` / `SQ Engine error` / `Decode failed` / `Normalize failed` / `ATS computation failed` / `Zone resolve failed` (502).

**`v1-docs`:**
`Document ID required` (400) · `Document not found` (404) · `Authentication required` (401) · `Admin access required` (403) · `POST method required for upload` (405) · `Missing required fields: ...` (400) · `Unknown action: ...` (400).

---

## 7. Changelog

| Versão | Data | Alterações |
|---|---|---|
| 1.0.0 | 2026-07-08 | Versão inicial. Documenta `address-gateway` (8 ações: create, verify, certify, lookup, list, validate, decode, delete), `api-v1` (REST pública + endpoint de parceiro Yamilook), `v1-docs` (biblioteca de documentos com SHA-256), autenticação (JWT/service role/anon/partner key), catálogo de ~100 Edge Functions por categoria e códigos de erro. Ancorado no código-fonte de `supabase/functions/`. |
