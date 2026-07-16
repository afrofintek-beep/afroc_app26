> CONFIDENCIAL — Propriedade intelectual da Afrofintek. Documento interno. Não colocar em public/.

# Manual 5 — Segurança & Anti-fraude (AFROLOC)

| | |
|---|---|
| **Versão** | 1.0.0 |
| **Data** | 2026-07-08 |
| **Aplica-se a** | app 1.0.0 |
| **Estatuto** | Fonte da verdade |
| **Classificação** | Confidencial (C) |

---

## 1. Âmbito

Este manual descreve os mecanismos de confiança e anti-fraude que sustentam a app AFROLOC, ancorado estritamente no código-fonte do repositório. Cobre:

1. **ATS — Address Trust Score:** os 6 fatores de confiança, pesos, fórmula ponderada e níveis de certificação (none → certificado).
2. **PoDP — Proof of Daily Presence:** a arquitetura silenciosa em 3 camadas (sampler no cliente → ingestão/anti-spoofing → rollup diário via `pg_cron`) e o reforço silencioso do ATS.
3. **Anti-spoofing GPS/EXIF:** deteção autoritativa no servidor.
4. **Risk engine & alertas:** cálculo de precariedade e ciclos de reverificação.
5. **Audit log:** registo de segurança.
6. **Estado operacional** verificado ao vivo.

**Princípio arquitetural transversal (verificado no código):** todo o cálculo sensível é **autoritativo no servidor**. O cliente só **renderiza** vereditos que o servidor devolve/persiste — nunca executa o algoritmo. Isto está explícito nos cabeçalhos de:

- `src/utils/atsScore.ts` — *"The scoring algorithm is authoritative on the server. This module only exposes types and pure display helpers"*.
- `src/utils/gpsSpoofingDetection.ts` — *"The spoofing detection algorithm is authoritative on the server. This module only exposes types and pure display helpers"*.
- `supabase/functions/_shared/spoofing.ts` — *"Portado do antigo detetor client-side (...) para o servidor, onde NÃO pode ser contornado nem inspecionado."*

---

## 2. ATS — Address Trust Score

O ATS quantifica a confiança de um endereço numa escala **0–100**, mapeada em **5 níveis de certificação (0–4)**. O cálculo autoritativo vive em `supabase/functions/ats-engine/index.ts` (o endpoint REST formal `supabase/functions/ats-score/index.ts` expõe a mesma lógica). O cliente lê `ats_score`, `ats_breakdown` e `certification_level` persistidos no registo.

### 2.1 Os 6 fatores e pesos

> **Nota terminológica:** o pedido refere "6 fatores (GPS, EXIF, foto, hierarquia admin, testemunhas, validador)". No código, os fatores autoritativos do ATS são **5** categorias de pontuação — GPS, Telecom, EXIF, Testemunhas, Auditoria. O 6.º "fator" de confiança do ecossistema é o **PoDP**, que age como *verificador silencioso* sobre o ATS (secção 3), e não como uma 6.ª categoria dentro da fórmula-base. "Foto" e "hierarquia admin" não são categorias autónomas do ATS: a foto entra via EXIF e via correspondência GPS-EXIF; a hierarquia administrativa (`level1..level4`) alimenta a resolução do endereço e o risk engine, não a pontuação-base do ATS. Registado como divergência entre documento-fonte histórico e código: `⚠️ a validar` a nomenclatura dos "6 fatores".

Pesos máximos por categoria (`ats-engine/index.ts`, `MAX_*`):

| Categoria | Pontos máx. | Constante |
|---|---:|---|
| GPS | 25 | `MAX_GPS` |
| Telecom | 25 | `MAX_TELECOM` |
| EXIF | 20 | `MAX_EXIF` |
| Testemunhas (witness) | 15 | `MAX_WITNESS` |
| Auditoria (audit/documentação) | 15 | `MAX_AUDIT` |
| **Total** | **100** | |

### 2.2 Fórmula por categoria

Cada categoria é uma soma de bónus com teto (`Math.min(MAX_x, score)`):

**GPS (`calculateGPSScore`, 0–25):**
- Base por ter GPS: **10**.
- Bónus de precisão (`accuracy`, metros): ≤5 m → +8; ≤10 m → +6; ≤20 m → +4; ≤50 m → +2.
- Bónus de validação: `validated` → +3; `withinCountryBounds` → +2.

**Telecom (`calculateTelecomScore`, 0–25):**
- Base por ter dados telecom: **5**.
- `operatorVerified` → +5.
- Qualidade de sinal: excellent +8 / good +6 / fair +4 / poor +2.
- Confiança de triangulação: `round(triangulationConfidence × 7)`.
- *Nota:* na obtenção por registo (`fetchRecordData`), telecom está atualmente `hasData: false` (comentário `TODO: Link to telecom data when available`) — logo, na prática o fator telecom contribui 0 até essa ligação existir. `⚠️ a validar` no lançamento.

**EXIF (`calculateEXIFScore`, 0–20):**
- Base por ter EXIF: **5**.
- Correspondência GPS-EXIF (`hasGPSMatch`), por distância `gpsExifDistance`: ≤10 m → +8; ≤50 m → +6; ≤100 m → +4; senão +2 (ou +5 se sem distância medida).
- `hasTimestamp` → +4.
- `hasDeviceInfo` → +3.

**Testemunhas (`calculateWitnessScore`, 0–15):**
- Confirmadas (`confirmedCount`): ≥3 → +7.5; ≥2 → +5.0; ≥1 → +2.5.
- Validadas (`validatedCount`): `min(5, validatedCount × 2.5)`.
- **Multiplicador de reputação:** `0.5 + (averageReputation / 200)` — escala de ×0.5 (rep. 0) a ×1.0 (rep. 100). Testemunhas de maior reputação contribuem mais (comentário: *"per AFROLOC Handbook Chapter 4"*).

**Auditoria (`calculateAuditScore`, 0–15):**
- Documentos: presentes → +4; verificados → +3.
- Auditoria de campo: existente → +4; aprovada → +4.
- *Nota:* em `fetchRecordData`, `hasFieldAudit: false` (`TODO`), pelo que a componente de auditoria de campo é atualmente 0. `⚠️ a validar`.

### 2.3 Total e persistência

`scores.total = gps + telecom + exif + witness + audit`. Após o cálculo, o servidor persiste em `afroloc_records`: `ats_score` (arredondado), `ats_breakdown` (objeto detalhado), `certification_level` e `ats_computed_at` — descrito no código como *"fonte de verdade para o cliente LER, em vez de recalcular o algoritmo no browser"*.

### 2.4 Níveis de certificação

Limiares autoritativos (`CERTIFICATION_LEVELS` em `ats-engine/index.ts`, por `minScore`):

| Nível | Nome (servidor) | minScore | Cliente (`atsScore.ts`) |
|---:|---|---:|---|
| 0 | Não Certificado | 0 | Unverified / *none* |
| 1 | Básico | 20 | Basic Verified |
| 2 | Verificado | 40 | Strong Verified |
| 3 | Validado | 60 | Multi-Layer Verified |
| 4 | Certificado | 80 | Fully Certified |

O nome comercial "bronze → prata → ouro → platina" do pedido **não** aparece literalmente no código: o servidor usa Não Certificado/Básico/Verificado/Validado/Certificado e o cliente usa as chaves i18n `ats.level0..4.*`. `⚠️ a validar` o mapeamento de nomenclatura de metais para os níveis 0–4. As cores de display são atribuídas por `getATSScoreColor`/`getATSProgressColor` por faixas de 20 pontos.

### 2.5 Flags de validação (anti-fraude no ATS)

`checkValidationFlags` marca:
- **`spoofingRisk`** — quando há EXIF e GPS mas sem correspondência e `gpsExifDistance > 100 m`.
- **`lowConfidence`** — `total < 30`.
- **`missingData`** — falta GPS, EXIF ou testemunhas.
- **`inconsistentData`** — telecom+GPS com `triangulationConfidence < 0.3`.

Estas flags são devolvidas ao cliente (ex.: em `address-verify` → `validationFlags`).

---

## 3. PoDP — Proof of Daily Presence

O PoDP é um **verificador silencioso** de presença: prova que o titular está realmente no endereço ao longo do tempo, sem UI, notificações ou toasts para o titular. Cabeçalho de `src/lib/podp/sampler.ts`: *"Silent background GPS sampler. NOT exposed to the holder via UI/toasts/notifications."* — e o endpoint de ingestão nota *"The holder cannot read their own samples."*

Arquitetura em **3 camadas**:

### 3.1 Camada 1 — Sampler no cliente (`src/lib/podp/sampler.ts`)

- **Ativação (`isSilentContextAllowed`):** utilizador autenticado + pelo menos um `afroloc_records` com `geo_lat/geo_lon`; corre em **Capacitor nativo** ou **PWA instalada (standalone)**; ignora iframe, preview/dev e hosts `id-preview--*`, `preview--*`, `*.preview.example`, `*.beta.example`.
- **Amostragem (`takeSample`):** `Geolocation.getCurrentPosition` (`enableHighAccuracy: false`, timeout 15 s, `maximumAge` 60 s). Intervalo por defeito **15 min** (`DEFAULT_INTERVAL_MIN`), configurável por `podp_config.sample_interval_minutes`. Primeira amostra escalonada por 30–60 s aleatórios (anti-padrão).
- **Fila offline:** amostras guardadas em **IndexedDB** (`afroloc-podp` / store `outbox`), drenadas em lotes até 50 e enviadas pela função `podp-sample`. Sync a cada 5 min e no evento `online`.
- **Kill switch:** se `podp_config.enabled === false`, o sampler para (`stopPodpSampler`).

### 3.2 Camada 2 — Ingestão + anti-spoofing (`supabase/functions/podp-sample/index.ts`)

Endpoint autenticado (Bearer + `getClaims`). Por cada lote (≤ `MAX_BATCH` = 50):

- **Rate limit diário:** `MAX_DAILY_SAMPLES` = 200 por utilizador (janela 24 h) → **429** se excedido.
- **Propriedade:** cada amostra só é aceite se o `afrolocRecordId` pertence ao `userId` autenticado (senão `rejected++`).
- **Anti-spoofing por amostra (`rejection_reason`):**
  - `low_precision` — menos de 4 casas decimais em lat **ou** lon (coordenada "redonda" = suspeita).
  - `low_accuracy` — `accuracy > podp_config.max_gps_accuracy_m` (default **100 m**).
- **Geofence (Haversine):** distância à coordenada do registo; raio de tolerância **urbano 75 m** / **rural 250 m** (`podp_config.tolerance_radius_urban_m` / `_rural_m`), decidido por `metadata.cellType`/`subdivisionType === 'urban'`. `is_within_radius = !reject && distance <= radius`.
- **Persistência:** upsert em `podp_samples` com `onConflict: 'user_id,client_generated_id', ignoreDuplicates` (dedupe idempotente). Devolve `{ accepted, rejected, received }`. O servidor mantém sempre o registo de auditoria das amostras (aceites e rejeitadas).

### 3.3 Camada 3 — Rollup diário (`supabase/functions/podp-rollup/index.ts`, via `pg_cron`)

Invocado **1×/dia às 03:00 UTC** (secção 3.4). Passos:

1. **Agrega** as amostras válidas (`is_within_radius = true`) do dia anterior (UTC) por `(user, record)`.
2. **Rollup diário** (`podp_daily_rollup`): `hours_present = (n_amostras × sample_interval_minutes) / 60`; `day_is_valid = hours_present >= min_hours_per_day` (default **6.0 h**). Upsert `onConflict: 'afroloc_record_id,day'`.
3. **Fecho de ciclo** (`podp_cycles`), janela `cycle_length_days` (default **14 dias**), idempotente (não refecha ciclo já existente). KPIs computados:
   - `verified_pct = validDays / cycleDays`.
   - Streaks (`longest_streak`, `current_streak`), horas médias, consistência = `clamp(1 − stddev(horas)/min_hours, 0, 1)`.
   - **`final_score = round((baseScore·0.7 + streakBonus·0.2 + consistency·0.1) × 100)`**, com `baseScore = validDays/cycleDays` e `streakBonus = min(1, longestStreak/cycleDays)`.
   - `podp_score = round(baseScore × 100)` (compatibilidade retro).
4. **Propagação:** grava `afroloc_records.metadata.podp` (score, final_score, verified_pct, streaks, ciclo) e marca `podp_cycles.applied_to_ats = true`.
5. **Retenção:** apaga amostras cruas (`podp_samples`) com mais de **90 dias**.
6. **Auditoria:** insere `podp_cycle_closed` em `security_audit_log`.

### 3.4 Agendamento (`supabase/migrations/20260701000000_schedule_podp_rollup.sql`)

`cron.schedule('podp-rollup-daily', '0 3 * * *', ...)` via `pg_cron` + `pg_net`, fazendo `net.http_post` para `/functions/v1/podp-rollup`. Idempotente (`cron.unschedule` prévio). **Segredos no Vault** (nunca versionados): `podp_project_url` e `podp_service_role_key`. Sem estes dois segredos, o job dispara mas o `net.http_post` não autentica — os ciclos nunca fecham.

### 3.5 Reforço silencioso do ATS (até +5)

**Intenção de design:** o PoDP reforça silenciosamente o ATS **até +5 pontos**. No código, o rollup escreve `applied_to_ats: true` e propaga `metadata.podp`, e o tipo cliente `ATSScoreInput` expõe um campo `podpScore?` (0..100) comentado como *"Proof of Daily Presence (silent verifier)"*.

`⚠️ a validar`: **o ponto de adição concreto do bónus PoDP ao total do ATS não está presente no código lido.** O `ats-engine`/`ats-score` **não** consomem `podpScore` na fórmula (as 5 categorias somam a 100 sem componente PoDP), e o campo `podpScore?` do cliente não é usado no cálculo. Ou seja: a infraestrutura PoDP calcula e persiste os KPIs e o flag `applied_to_ats`, mas a soma efetiva "até +5" ao ATS ainda **não** aparece implementada nas funções de scoring. Confirmar antes de comunicar externamente o efeito exato no ATS.

### 3.6 Leitura administrativa (`supabase/functions/podp-admin/index.ts`)

Endpoint **restrito a admin com `current_level >= 4`** (`user_authorization_levels`), senão **403**. Expõe ciclos, rollups diários, amostras (com `details=1&recordId`) e um `rejectionBreakdown` agregado por `rejection_reason`. Cada leitura regista `podp_admin_read` em `security_audit_log`. O titular **nunca** acede aos seus próprios dados PoDP.

---

## 4. Anti-spoofing GPS/EXIF

### 4.1 Detetor autoritativo (`supabase/functions/_shared/spoofing.ts`)

`detectSpoofing(input)` devolve `{ isSuspicious, riskLevel, riskScore (0–100), alertCodes[] }`. Baseado no *AFRO ID Operational Handbook — Cap. 4.5 & 10.10*. Regras somadas ao `riskScore`:

| Verificação | Condição | +risco | Código |
|---|---|---:|---|
| GPS dispositivo vs EXIF | dist. > 5000 m | +50 | `GPS_EXIF_MAJOR_MISMATCH` |
| " | > 1000 m | +30 | `GPS_EXIF_MISMATCH` |
| " | > 200 m | +10 | `GPS_EXIF_MINOR_DIFF` |
| Sem EXIF GPS | tem device, sem EXIF | +5 | `NO_EXIF_GPS` |
| Timestamp EXIF vs ref. | diff > 24 h + 15 h (fuso) | +40 | `TIMESTAMP_MAJOR_MISMATCH` |
| " | diff > 15 h + 1 h | +20 | `TIMESTAMP_MISMATCH` |
| Movimento impossível | velocidade > 1000 km/h | +60 | `IMPOSSIBLE_MOVEMENT` |
| " | > 300 km/h | +30 | `SUSPICIOUS_MOVEMENT` |
| Precisão GPS baixa | `accuracy > 100 m` | +15 | `LOW_GPS_ACCURACY` |

`riskScore` limitado a 100. Níveis: `critical ≥ 80`, `high ≥ 50`, `medium ≥ 30`, `low ≥ 10`, senão `none`. **`isSuspicious = riskScore ≥ 30`** (tolerância de fuso horário de 15 h embutida na regra de timestamp).

### 4.2 Integração (`supabase/functions/address-verify/index.ts`)

Na verificação de endereço, o servidor chama `detectSpoofing` comparando o GPS atual do dispositivo com o EXIF da foto guardada no registo. **Persiste** em `afroloc_records`: `gps_risk_score`, `gps_risk_level`, `gps_verified (= !isSuspicious)`, `gps_checked_at`; regista `address_verify` em `security_audit_log`; e devolve ao cliente `gpsRisk { level, score, verified, alertCodes }`. O cliente (`gpsSpoofingDetection.ts`, `GPSSpoofingAlert.tsx`) apenas **mostra** o veredito.

### 4.3 Extração EXIF no cliente (`src/hooks/useExifExtractor.ts`)

Usa `exifr` para extrair GPS (fast path `exifr.gps`) e tags seletivas (`DateTimeOriginal`, `Make`, `Model`, `Software`, etc.), com `yieldToBrowser` para não bloquear o UI móvel. `validateExifGPS` compara EXIF vs GPS capturado com tolerância ~0.01° (~1 km) — verificação **indicativa** no cliente; a decisão autoritativa é sempre a de `detectSpoofing` no servidor.

---

## 5. Risk engine & alertas

Dois mecanismos distintos de "risco", ambos separados do spoofing GPS:

### 5.1 Risco de reverificação (`src/utils/verificationRisk.ts`)

`calculateVerificationRisk` produz um `riskScore (0–100)` que define a **frequência cíclica de reverificação** de um endereço validado. 6 fatores de precariedade:

| Fator | Máx. |
|---|---:|
| Completude do endereço | 20 |
| Estabilidade do tipo de propriedade | 15 |
| Validação GPS (inc. consistência GPS-EXIF) | 15 |
| Qualidade das testemunhas | 15 |
| ATS Score | 20 |
| Histórico de verificação | 15 |

`PROPERTY_TYPE_RISK` pondera o tipo (residência 5 … informal 20). Faixas → ciclo: `<15` very_low (1×/ano, 12 meses); `<35` low (2×, 6 m); `<55` medium (3×, 4 m); `<75` high (4×, 3 m); senão very_high (6×, 2 m). Devolve estado do ciclo (`verified/upcoming/urgent/overdue`), progresso, dias restantes e **chaves i18n de mitigação** (`mitigation_*`). `shouldShowVerificationCycle` limita a exibição a estados `approved/validated/certified/active`.

### 5.2 Alertas de risco (`supabase/functions/check-risk-alerts/index.ts`)

Varre todos os `afroloc_records` e recalcula um `riskScore (0–100)` server-side com 3 componentes: completude do endereço (0–30), progresso do ciclo/`next_verification_due` (0–40, 40 se em atraso), histórico de verificação (0–30). Por utilizador, lê `risk_alert_settings` (`high_risk_threshold` default 75, `critical_risk_threshold` default 85, `alert_type`, `enabled`):
- `≥ critical` → alerta `critical_risk`.
- `≥ high` → alerta `high_risk`, **desde que** não haja alerta enviado nas últimas 24 h (`risk_alerts_log`) — dedupe anti-spam.

Os alertas são despachados para `send-risk-alert` (email/canal conforme `alert_type`). Existem funções relacionadas: `send-risk-alert`, `send-fraud-alert-email`. `⚠️ a validar` o gatilho agendado (cron) de `check-risk-alerts` — não confirmado numa migração nesta leitura.

---

## 6. Audit log

Registo central em `security_audit_log`, escrito pelas funções sensíveis (`address_verify`, `podp_cycle_closed`, `podp_admin_read`, etc.). Leitura via `supabase/functions/audit-log/index.ts`:

- **Autorização:** `getCurrentUser` + `requireRoles("admin", "admin_national", "admin_province", "admin_municipality", "auditor_read")`.
- **Ações:** `list` (paginado, filtros por ação/utilizador/datas), `stats` (contagens por ação, atividade diária, utilizadores únicos), `export` (JSON/CSV; o próprio export é auditado com `AUDIT_EXPORT`).
- Campos: `id, user_id, action, function_name, details, ip_address, created_at`.

---

## 7. Estado operacional

> **NOTA — Estado verificado ao vivo (2026-07-09, projeto Supabase `ljcxqwjvjgobhisqkujr`):**
> - Cron **`podp-rollup-daily` ativo** e a correr com **sucesso** (agendamento `0 3 * * *`).
> - **2/2 segredos do Vault presentes** (`podp_project_url`, `podp_service_role_key`).
> - **0 amostras / 0 rollups / 0 ciclos** até à data (fase **pré-lançamento**).
>
> **Conclusão:** o subsistema PoDP está **implementado e a correr, mas ainda sem dados reais**. A pipeline (sampler → ingestão → rollup → auditoria) está montada e agendada; falta apenas tráfego de utilizadores reais para começar a produzir ciclos e KPIs.

Pontos abertos consolidados (`⚠️ a validar`):
1. Nomenclatura "6 fatores (…foto, hierarquia admin, validador)" vs. as 5 categorias do código (secção 2.1).
2. Nomes de nível "bronze/prata/ouro/platina" vs. Não Certificado…Certificado (secção 2.4).
3. Reforço PoDP "até +5" no ATS — infraestrutura presente (`applied_to_ats`, `metadata.podp`, campo `podpScore?`) mas **ponto de adição ao total do ATS não implementado** nas funções de scoring lidas (secção 3.5).
4. Fatores telecom e auditoria de campo atualmente a 0 em `fetchRecordData` (`TODO`) (secção 2.2).
5. Gatilho agendado de `check-risk-alerts` não confirmado nesta leitura (secção 5.2).

---

## 8. Changelog

| Versão | Data | Alterações |
|---|---|---|
| 1.0.0 | 2026-07-08 | Versão inicial. ATS (5 categorias/100, níveis 0–4), PoDP (3 camadas + cron 03:00 UTC), anti-spoofing GPS/EXIF autoritativo, risk engine (reverificação + alertas), audit log. Nota de estado ao vivo 2026-07-09 (implementado, sem dados reais). Pontos `⚠️ a validar` registados. |
