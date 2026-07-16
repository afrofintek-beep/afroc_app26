> CONFIDENCIAL — Propriedade intelectual da Afrofintek. Documento interno. Não colocar em public/.

# Manual 10 — Operações / Runbook — AFROLOC

| Campo | Valor |
|---|---|
| Versão | 1.0.0 |
| Data | 2026-07-08 |
| Aplica-se a | app 1.0.0 |
| Estatuto | Fonte da verdade |
| Classificação | Confidencial (C) |

---

## 1. Âmbito

Este runbook cobre a operação da app **AFROLOC** em produção: como fazer deploy do frontend, das edge functions e das migrações; que segredos e variáveis são obrigatórios; que tarefas correm em cron; como monitorizar; e como resolver os incidentes mais comuns.

Não cobre: arquitetura funcional, algoritmo do codec, ou especificação do PoDP (ver documentos próprios). Aqui só entra o que é necessário para **manter a app de pé** e **repor serviço** quando algo falha.

Componentes operacionais:

- **Frontend** — SPA Vite/React, servida no Vercel.
- **Backend** — projeto Supabase (`ljcxqwjvjgobhisqkujr`): base de dados Postgres, Auth, Edge Functions e cron (pg_cron).
- **Mapa/geocoding** — Mapbox, sempre via a edge function `get-mapbox-token` (o token nunca é exposto ao cliente diretamente).
- **PoDP (Proof of Daily Presence)** — recolha de amostras GPS + rollup diário agendado por cron.
- **App móvel** — empacotamento Capacitor (iOS/Android) com permissões de câmara (ver §6 e anexo).

---

## 2. Ambientes e deploy

### 2.1 Frontend (Vercel)

| Item | Valor |
|---|---|
| Repositório | `afrofintek-beep/afroc_app26` |
| Alias de produção | `afroc-app26-rose.vercel.app` |
| Branch de produção | ⚠️ a validar — o checkout local está em `afroloc-partner-certification-status` (não `main`); confirmar no dashboard do Vercel qual a *Production Branch* configurada |
| Build | Vite (`npm run build` → `dist/`) — ⚠️ a validar comando exato no `package.json`/Vercel |

O deploy do frontend é feito pelo Vercel a partir de push no repositório GitHub. A produção responde no alias `afroc-app26-rose.vercel.app`.

**Passos (deploy normal):**

1. Fazer merge/push para a *Production Branch* configurada no Vercel (ver ⚠️ acima antes de assumir `main`).
2. O Vercel dispara o build automaticamente.
3. Confirmar em Vercel → Deployments que o build passou e ficou *Ready*.
4. Smoke test em `https://afroc-app26-rose.vercel.app` (ver §5).

**Rollback:** em Vercel → Deployments, promover um deployment anterior *Ready* a produção (*Promote to Production*), ou reverter o commit no branch.

> Nota: os **previews** do Vercel podem ter *Deployment Protection* ligada (autenticação Vercel), o que faz o preview pedir login e parecer "partido" a quem não está autenticado. Ver §6.

### 2.2 Backend (Supabase — projeto `ljcxqwjvjgobhisqkujr`)

Tudo o que é backend vive neste projeto Supabase. O cliente frontend liga-se via as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (ver `src/integrations/supabase/client.ts`).

**Deploy de migrações de base de dados:**

```bash
# a partir da raiz do repo, com a CLI Supabase autenticada e o projeto ligado
supabase link --project-ref ljcxqwjvjgobhisqkujr   # (uma vez)
supabase db push
```

As migrações vivem em `supabase/migrations/`. São aplicadas por ordem de timestamp. A migração do cron do PoDP (`20260701000000_schedule_podp_rollup.sql`) é **idempotente** — pode ser reaplicada sem duplicar o agendamento (faz `cron.unschedule` antes de reagendar).

**Deploy de edge functions:**

```bash
# uma função específica
supabase functions deploy get-mapbox-token --project-ref ljcxqwjvjgobhisqkujr
# (repetir por cada função em supabase/functions/, ex.: podp-rollup)
```

> ⚠️ a validar: comandos exatos da CLI podem variar consoante a versão; confirmar `supabase --version` e a documentação da versão instalada.

**Ordem recomendada num ambiente novo / após reset da BD:**

1. `supabase db push` (aplica extensões, tabelas, RLS e o agendamento do cron).
2. Popular o **Vault** com `podp_project_url` e `podp_service_role_key` (ver §3) — **antes** de o cron correr às 03:00 UTC.
3. Definir o segredo `MAPBOX_PUBLIC_TOKEN` das edge functions (ver §3).
4. Deploy das edge functions (`get-mapbox-token`, `podp-rollup`, e restantes em `supabase/functions/`).
5. Deploy do frontend (§2.1) com as `VITE_*` a apontar para este projeto.

---

## 3. Segredos e variáveis

Nenhum segredo abaixo está no repositório. Todos são definidos fora do código (Vercel env, Supabase Edge Function secrets, Supabase Vault). **Nunca versionar.**

### 3.1 Frontend (variáveis de ambiente Vercel)

| Variável | Usada em | Efeito se faltar |
|---|---|---|
| `VITE_SUPABASE_URL` | `src/integrations/supabase/client.ts` | Cliente Supabase não inicializa — app sem backend |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `src/integrations/supabase/client.ts` | Idem — Auth/queries falham |

Estas são variáveis de **build** (prefixo `VITE_`, embutidas no bundle). Alterá-las exige um novo build no Vercel para terem efeito.

> Nota de higiene (histórico noutro projeto): ao colar a anon/publishable key, garantir que não vão caracteres invisíveis / "bolinhas" — copiar do dashboard Supabase, não de UIs que mascaram o valor.

### 3.2 Edge Functions (Supabase Edge Function secrets)

| Segredo | Usado em | Efeito se faltar |
|---|---|---|
| `MAPBOX_PUBLIC_TOKEN` | `supabase/functions/get-mapbox-token/index.ts` (`Deno.env.get('MAPBOX_PUBLIC_TOKEN')`) | A função lança `MAPBOX_PUBLIC_TOKEN not configured` e devolve HTTP 400 → **mapa fica em branco**, geocoding e pesquisa de cidades falham |

Definir com:

```bash
supabase secrets set MAPBOX_PUBLIC_TOKEN=pk.xxxxx --project-ref ljcxqwjvjgobhisqkujr
```

A `get-mapbox-token` exige `Authorization` no pedido (devolve 401 sem header) e, com o token presente, faz reverse geocoding, forward geocoding (com filtro de país AO/MZ/ZA/…) ou devolve o token conforme o corpo do pedido.

### 3.3 Vault (segredos da BD para o cron do PoDP)

Definidos no **Vault da base de dados live**, nunca no repo. Lidos pela função de cron via `vault.decrypted_secrets`.

| Segredo (Vault) | Valor esperado | Efeito se faltar |
|---|---|---|
| `podp_project_url` | `https://ljcxqwjvjgobhisqkujr.supabase.co` (`https://<project-ref>.supabase.co`) | O `net.http_post` do cron não sabe o URL → rollup não corre |
| `podp_service_role_key` | *service_role key* do projeto | O `Authorization: Bearer …` fica inválido → o `podp-rollup` responde 401, o rollup **não autentica** |

Popular o Vault (uma forma; ⚠️ a validar sintaxe conforme versão):

```sql
select vault.create_secret('https://ljcxqwjvjgobhisqkujr.supabase.co', 'podp_project_url');
select vault.create_secret('<SERVICE_ROLE_KEY>', 'podp_service_role_key');
```

Consequência crítica: **numa BD nova, popular o Vault ANTES das 03:00 UTC.** Caso contrário o job dispara mas não autentica — os ciclos de presença nunca fecham e o KPI nunca é calculado (as amostras GPS continuam a ser recolhidas, mas ficam sem processar).

---

## 4. Cron & tarefas agendadas

Fonte: `supabase/migrations/20260701000000_schedule_podp_rollup.sql`.

| Job | Agendamento | O que faz | Requisitos |
|---|---|---|---|
| `podp-rollup-daily` | `0 3 * * *` (**03:00 UTC**, diário) | `net.http_post` para `<podp_project_url>/functions/v1/podp-rollup` com `Authorization: Bearer <podp_service_role_key>` e corpo `{}`. Fecha ciclos de presença e calcula o KPI do PoDP. | extensões `pg_cron` e `pg_net`; Vault com `podp_project_url` e `podp_service_role_key`; edge function `podp-rollup` deployada |

Características:

- **Idempotente:** a migração faz `cron.unschedule('podp-rollup-daily')` (num bloco que ignora erro se não existir) antes de reagendar. Pode ser reaplicada sem duplicar.
- **Fuso:** 03:00 **UTC** — atenção ao converter para hora de Angola (WAT, UTC+1 → 04:00 local).

**Verificar o agendamento:**

```sql
select jobid, schedule, jobname, active
from cron.job
where jobname = 'podp-rollup-daily';
```

**Ver execuções recentes (sucesso/erro):**

```sql
select jobid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'podp-rollup-daily')
order by start_time desc
limit 20;
```

**Forçar uma execução manual** (para testar sem esperar pelas 03:00): invocar diretamente a edge function `podp-rollup` com a service_role key no `Authorization`, ou reexecutar o corpo do `net.http_post` da migração. ⚠️ a validar num ambiente controlado antes de correr em produção.

---

## 5. Monitorização

Não há (ainda) alertas automáticos configurados — a monitorização é feita por verificação manual/periódica. ⚠️ a validar se existe algo além do dashboard Supabase/Vercel.

**Frontend (Vercel):**

- Vercel → Deployments: último deploy *Ready*, sem *Error*.
- Smoke test em `https://afroc-app26-rose.vercel.app`: a app carrega, login funciona, **o mapa desenha** (se ficar em branco → §6.1).

**Backend (Supabase):**

- Dashboard → Logs das Edge Functions: procurar erros da `get-mapbox-token` (ex.: `MAPBOX_PUBLIC_TOKEN not configured`) e da `podp-rollup`. A `get-mapbox-token` faz `console.log`/`console.error` abundante — útil para diagnóstico de geocoding.
- Dashboard → Database → verificar RLS e conectividade.

**Cron / PoDP:**

- Consultar `cron.job_run_details` (queries em §4) diariamente ou após incidente. `status = 'succeeded'` e `return_message` sem erro HTTP.
- Confirmar que os ciclos de presença fecharam e o KPI foi calculado no dia seguinte às 03:00 UTC.

**Checklist rápido pós-deploy:**

1. Deploy Vercel *Ready*.
2. App carrega e faz login.
3. Mapa desenha (token OK).
4. `cron.job` mostra `podp-rollup-daily` `active = true`.
5. Sem erros novos nos logs das edge functions.

---

## 6. Incidentes comuns e resolução

### 6.1 Mapa em branco / geocoding falha

- **Sintoma:** mapa não desenha, pesquisa de cidades ou reverse geocoding sem resultados; logs da edge mostram `MAPBOX_PUBLIC_TOKEN not configured` (HTTP 400).
- **Causa mais provável:** falta o segredo **`MAPBOX_PUBLIC_TOKEN`** na edge function `get-mapbox-token`.
- **Resolução:**
  1. `supabase secrets set MAPBOX_PUBLIC_TOKEN=pk.xxxxx --project-ref ljcxqwjvjgobhisqkujr`
  2. Redeploy da função: `supabase functions deploy get-mapbox-token --project-ref ljcxqwjvjgobhisqkujr`
  3. Confirmar no smoke test que o mapa volta.
- **Outras causas a excluir:** pedido sem `Authorization` (a função devolve 401), quota/token Mapbox inválido, CORS.

### 6.2 Rollup do PoDP não corre / não autentica

- **Sintoma:** ciclos de presença não fecham, KPI não é calculado; `cron.job_run_details` mostra falha ou HTTP 401 no `podp-rollup`.
- **Causas:** Vault sem `podp_project_url` e/ou `podp_service_role_key`; ou service_role key errada/rodada; ou a edge function `podp-rollup` não deployada; ou extensões `pg_cron`/`pg_net` em falta.
- **Resolução:**
  1. Confirmar os dois segredos no Vault (§3.3) e repô-los se faltarem.
  2. Confirmar que `podp-rollup` está deployada.
  3. Confirmar `pg_cron` e `pg_net` instaladas.
  4. Reexecutar o job manualmente (§4) e verificar `job_run_details`.

### 6.3 Falha ao apagar endereço

- **Sintoma:** o utilizador tenta apagar um endereço e a operação falha.
- **Causas prováveis:**
  - **Sessão expirada** — o token de auth caducou (o cliente tem `autoRefreshToken: true`, mas se o refresh falhou o pedido vai sem sessão válida). Resolução: pedir novo login e repetir.
  - **Restrição de chave estrangeira (FK)** — o endereço está referenciado por outro registo, o que impede o DELETE. Resolução: identificar a dependência e tratar (apagar/soft-delete a montante, ou apagar em cascata se for o comportamento pretendido). ⚠️ a validar quais as tabelas/FK envolvidas no schema.
- **Diagnóstico:** ver a mensagem de erro do Supabase (401/403 → sessão/RLS; erro de constraint `foreign key` → FK).

### 6.4 Preview do Vercel pede login / parece partido

- **Sintoma:** um deployment de *preview* abre um ecrã de autenticação Vercel em vez da app.
- **Causa:** **Deployment Protection** ligada nos previews do projeto Vercel.
- **Resolução:** autenticar-se com a conta Vercel do projeto; ou, para partilhar um preview, gerar um *Protection Bypass*/link partilhável nas definições do Vercel; ou desligar a proteção para previews (com ponderação de segurança). A **produção** (`afroc-app26-rose.vercel.app`) não é afetada por isto.

### 6.5 App móvel: câmara não abre / permissões negadas

- **Sintoma:** na captura offline de ID de testemunha, a câmara não abre ou dá "permission denied".
- **Referência:** ver anexo **`public/CAMERA_PERMISSIONS.md`** (setup de permissões Capacitor).
- **Resumo da resolução:**
  - **iOS:** confirmar as 3 chaves `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription` no `Info.plist`; correr `npx cap sync`.
  - **Android:** confirmar `CAMERA` e `READ_MEDIA_IMAGES` (Android 13+) no `AndroidManifest.xml`.
  - Se a permissão foi negada permanentemente, ativar manualmente nas definições do dispositivo; testar em dispositivo físico (emuladores têm câmara limitada).

---

## 7. Changelog

| Versão | Data | Alteração |
|---|---|---|
| 1.0.0 | 2026-07-08 | Versão inicial do runbook operacional (deploy Vercel + Supabase, segredos, cron `podp-rollup-daily`, monitorização e incidentes comuns). |

---

### Anexos e fontes (âncoras no código)

- `supabase/migrations/20260701000000_schedule_podp_rollup.sql` — cron `podp-rollup-daily`, pg_cron/pg_net, Vault (`podp_project_url`, `podp_service_role_key`).
- `supabase/functions/get-mapbox-token/index.ts` — segredo `MAPBOX_PUBLIC_TOKEN`.
- `src/integrations/supabase/client.ts` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `public/CAMERA_PERMISSIONS.md` — permissões de câmara Capacitor (iOS/Android).
