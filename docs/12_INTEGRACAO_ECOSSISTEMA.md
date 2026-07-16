# Manual 12 — Integração do Ecossistema

> **Versão** 1.0.0 · **Data** 2026-07-08 · **Aplica-se a** app 1.0.0 · **Fonte da verdade** · **Classificação: Interno (I)**

Documento interno. Descreve como as aplicações do ecossistema Afrofintek se ligam à AFROLOC. Tudo o que diz respeito à AFROLOC está ancorado no código deste repositório. Tudo o que diz respeito a outras apps (Yamioo, Yamilook, Sumba, Kilapi), que vivem em repositórios e bases de dados separadas, está marcado com `⚠️ a validar`.

---

## 1. Âmbito

Este manual explica **o que a AFROLOC oferece às outras apps** e **como essa ligação está construída**, não como cada app externa a consome por dentro (isso pertence aos manuais dessas apps).

Cobre:

- As apps do ecossistema e o papel de cada uma (secção 2).
- O princípio fundador da integração: **o código AFROLOC é um lugar, não uma pessoa** (secção 3).
- O modelo de integração — bases separadas ligadas por **contrato** (chave partilhada + links), não fusão (secção 4).
- Os **webhooks e o livro de eventos** que alimentam a reputação e a Kilapi (secção 5).
- As **decisões arquiteturais** já tomadas (secção 6).

Não cobre: o algoritmo do codec (ver manual do codec), a operação interna de Yamioo/Yamilook, nem o SSO futuro (ainda não construído).

---

## 2. As apps do ecossistema

O ecossistema Afrofintek é um conjunto de apps independentes que partilham a AFROLOC como camada comum de **endereçamento**.

| App | Papel | Relação com a AFROLOC |
|-----|-------|-----------------------|
| **AFROLOC** | Endereçamento — atribui e verifica códigos de endereço geográficos. | É a **fonte** do código e da verificação de proximidade. Este repositório. |
| **Yamioo** | Super-busca — encontra lugares/entidades. | Consome a AFROLOC como chave de lugar; regista e procura entidades por código. `⚠️ a validar` (repo separado). |
| **Yamilook** | Rede social. | Cada perfil carrega um `afroloc_code`; liga-se a entidades Yamioo por reivindicação. `⚠️ a validar` (repo separado). |
| **Sumba** | Loja / comércio. | Usa o endereço AFROLOC para entrega e localização de vendedores. `⚠️ a validar` (repo separado). |
| **Kilapi** | Score / dados. | Consome o **livro de eventos** agregado do ecossistema para calcular reputação/score. `⚠️ a validar` (repo separado). |

Do lado da AFROLOC, a integração com o ecossistema materializa-se em quatro Edge Functions Supabase (`supabase/functions/`):

- **`yamioo-gateway`** — porta de entrada para parceiros externos (lookup, verify, subscribe, status).
- **`webhook-dispatch`** — despacha eventos AFROLOC para todos os subscritores ativos.
- **`receive-webhook`** — recebe eventos (de outras apps AFROLOC internas ou parceiros).
- **`manage-yamioo-agents`** — administração de agentes Yamioo (papel `yamioo_agent`).

---

## 3. Princípio: AFROLOC é lugar, não pessoa

Este é o conceito estruturante de toda a integração. **Interpretar mal este ponto leva a bugs de privacidade e de identidade.**

### 3.1. O código é um endereço

Um código AFROLOC identifica **um lugar geográfico** — um prédio, um lote, uma coordenada resolvida a uma célula. O formato reflete isto (ver `yamioo-gateway/index.ts`):

```
Standard:      AO-ZU-G10-X35O8-YN247T           (CC-ZT-Gnn-Xxxxx-Yyyyy)
Nomenclatura:  AO-LUA-BEL-TAL-CAM-G10-X35O8-YN247T   (CC-PROV-MUN-COM-BAI-Gnn-Xxxxx-Yyyyy)
```

Nenhum destes componentes identifica uma pessoa: são país, zona (urbana/rural), grelha e coordenadas codificadas. O registo em `afroloc_records` guarda o lugar (`geo_lat`, `geo_lon`, hierarquia administrativa, tipo de propriedade), não uma identidade.

### 3.2. Duas pessoas no mesmo prédio partilham o código

Consequência direta: **várias pessoas — e várias entidades — podem legitimamente ter o mesmo código AFROLOC** (o mesmo prédio, andares diferentes; uma loja e a família que vive por cima). O código **não é** um bilhete de identidade único.

### 3.3. O que o AFROLOC pode e não pode ser

| Pode ser | NÃO pode ser (sozinho) |
|----------|------------------------|
| Chave de **lugar** para juntar dados geográficos entre apps. | Chave de **identidade** de pessoa. |
| Base de **reputação geográfica** (o que acontece naquele lugar). | Prova de que "é a mesma pessoa" em duas apps. |
| Âncora para verificar proximidade de entrega (`verify`). | Mecanismo de login ou de fusão automática de contas. |

### 3.4. Regra de ouro

> A "mesma pessoa em todo o lado" exige **identidade de pessoa** (contas ligadas + ID de pessoa), **nunca** o código AFROLOC. O AFROLOC responde a *"onde"*, não a *"quem"*.

Por isso a ligação Yamioo↔Yamilook é feita por **reivindicação (claim)** explícita, e nunca por *match* automático de códigos AFROLOC iguais (ver secção 6).

---

## 4. Modelo de integração (contrato, chave, claim)

### 4.1. Bases de dados separadas — integração por contrato

Cada app tem a sua própria base Supabase. **As bases não se fundem.** A AFROLOC não lê nem escreve diretamente nas tabelas de outras apps, e vice-versa. A integração faz-se por **contrato**: uma API estável + eventos assinados.

O contrato tem três peças:

1. **Chave partilhada de lugar** — o código AFROLOC, no formato acima.
2. **Links** — cada app guarda o código AFROLOC (e, quando aplicável, referências de claim) nas suas próprias tabelas. `⚠️ a validar`: do lado Yamilook, `afroloc_code` está presente nos perfis; do lado Yamioo, o código é uma coluna gerada em `entidades.afroloc`.
3. **Segredo partilhado** — cada subscrição de webhook tem um `secret` próprio, usado para assinar/verificar cada entrega (HMAC-SHA256).

### 4.2. A porta de entrada: `yamioo-gateway`

Ficheiro: `supabase/functions/yamioo-gateway/index.ts`. Um parceiro chama `POST /yamioo-gateway?action=<ação>`:

| Ação | Método | O que faz |
|------|--------|-----------|
| `status` | GET | Health check; devolve versão (`2.0.0`), formatos de código e lista de endpoints. |
| `lookup` | POST | Resolve por `code` (lê `afroloc_records`) **ou** por `latitude`+`longitude` (delega em `qg-engine`). Devolve o endereço + hierarquia + coordenadas. |
| `verify` | POST | Dado `code` + `latitude`+`longitude`, mede a distância Haversine ao ponto registado. Verificado se `≤` limiar: **150 m** para endereço `formal`, **500 m** para outros. |
| `subscribe` | POST | Cria uma subscrição de webhook em `webhook_subscriptions` (o `secret` é guardado como **hash SHA-256**, não em claro). |

Notas ancoradas no código:

- O `gateway` corre com `SUPABASE_SERVICE_ROLE_KEY` (acesso de servidor autoritativo).
- O código recebido é **normalizado** (`normalizeAfrolocCode`): aceita formato standard, nomenclatura e converte tags legadas `URBAN`/`RURAL` → `ZU`/`ZR`.
- Eventos válidos aceites no `subscribe`: `address.created`, `address.status_changed`, `address.verified`, `checkin.completed`, `witness.confirmed`, `resident.approved`.

### 4.3. A ligação entre pessoas: reivindicação (claim)

A chave de lugar liga **dados geográficos**; não liga contas. Para dizer "esta entidade Yamioo é o dono deste perfil Yamilook", existe um fluxo de **reivindicação** explícita, aprovada, não automática.

`⚠️ a validar` (repos Yamioo/Yamilook): do lado Yamilook existe já perfil público `/u/<username>` e um RPC `get_public_profile` (anónimo) para servir de destino da ligação; o fluxo/tabela de claim (entidade Yamioo ↔ perfil Yamilook) e o botão "Ver perfil social" estão previstos mas por confirmar no código dessas apps.

### 4.4. Agentes Yamioo

Ficheiro: `supabase/functions/manage-yamioo-agents/index.ts`. Um **agente Yamioo** é um utilizador da AFROLOC com o papel `yamioo_agent` (tabela `yamioo_agents` + `user_roles`). Só um **admin** gere agentes:

- `GET` — lista agentes, enriquecidos com dados de `profiles` e email do `auth`.
- `POST { user_id, notes? }` — regista (ou reativa) um agente; usa a função de BD `register_yamioo_agent`.
- `DELETE { agent_id }` — desativa o agente e remove o papel.

Toda a operação é registada via `audit(...)`.

---

## 5. Webhooks e eventos

O guia técnico completo (validação de assinatura em TS/Deno, Node, Python) está em `public/WEBHOOK_INTEGRATION.md`. Esta secção resume o desenho.

### 5.1. Saída — `webhook-dispatch`

Ficheiro: `supabase/functions/webhook-dispatch/index.ts`. Chamado **internamente** (por trigger de BD ou outra função) quando ocorre um evento de endereço. Fluxo:

1. Recebe o payload com `event` + dados do registo.
2. Procura em `webhook_subscriptions` todas as subscrições **ativas** que escutam esse `event` (`is_active = true` e `events` contém o evento).
3. Entrega a **todas em paralelo** (`Promise.allSettled`), com timeout de **10 s** por entrega.
4. Cada entrega é registada em `webhook_logs` (status, corpo truncado a 1000 chars, `delivered_at`/`failed_at`).

Cabeçalhos de cada entrega:

| Header | Conteúdo |
|--------|----------|
| `X-Afroloc-Signature` | HMAC-SHA256 (hex) do corpo, com o `secret` da subscrição. |
| `X-Afroloc-Event` | Tipo de evento. |
| `X-Afroloc-Timestamp` | ISO 8601 do envio. |
| `User-Agent` | `AFROLOC-Webhook/1.0` |

### 5.2. Entrada — `receive-webhook`

Ficheiro: `supabase/functions/receive-webhook/index.ts`. Endpoint genérico para **receber** eventos AFROLOC (de outras apps internas ou, no futuro, de parceiros). Garantias:

- **Valida a assinatura** HMAC-SHA256 (comparação em tempo constante) se `WEBHOOK_RECEIVER_SECRET` estiver configurado; caso contrário responde `401`.
- **Rejeita eventos com mais de 5 minutos** (frescura de timestamp).
- Processa por tipo de evento e **regista cada um em `security_audit_log`** (o "livro de eventos" local).

### 5.3. Eventos suportados

| Evento | Descrição |
|--------|-----------|
| `address.created` | Novo endereço AFROLOC criado. |
| `address.status_changed` | Status alterado (ex.: `pending → approved → active`). |
| `address.verified` | Verificação de endereço concluída. |
| `address.certified` | Certificação concedida. |
| `checkin.completed` | Check-in de residente concluído. |
| `request.created` | Novo pedido AFROLOC (via SMS/web). |
| `request.approved` | Pedido aprovado pelo admin. |

Boas práticas contratuais (de `WEBHOOK_INTEGRATION.md`): validar sempre a assinatura, verificar o timestamp, responder `HTTP 200` em `< 10 s`, e ser **idempotente** (usar `recordId` + `event` como chave de deduplicação — o mesmo evento pode chegar mais de uma vez).

### 5.4. O "livro de eventos" e a Kilapi

O conjunto de eventos que fluem no ecossistema forma um **livro de eventos** — um registo append-only de *o que aconteceu, onde* (chaveado por lugar/AFROLOC), que alimenta a **Kilapi** para calcular score/reputação.

- Do lado da AFROLOC, `receive-webhook` já persiste eventos em `security_audit_log`.
- `⚠️ a validar` (repo Yamioo): a Kilapi consome uma tabela `eventos` (sujeito = `entidade_id`, lugar = `afroloc`, `pessoa_id` reservado) **sem leitura pública** — apenas `service role`/Kilapi. Reputação é **de lugar**, coerente com a secção 3.

---

## 6. Decisões arquiteturais

Decisões tomadas pelo dono em 2026-07-08, que enquadram toda a integração:

1. **AFROLOC = lugar, não identidade.** O código é chave geográfica e base de reputação de lugar; nunca identidade de pessoa por si só (secção 3).
2. **Bases separadas, integração por contrato.** Cada app mantém a sua base Supabase; ligam-se por chave partilhada + links + webhooks assinados. **Não há fusão de bases.**
3. **Identidade = contas ligadas + ID de pessoa.** A "mesma pessoa em todo o lado" resolve-se com um ID de pessoa distinto do código de endereço, com caminho para SSO no futuro.
4. **Ligação Yamioo↔Yamilook por reivindicação (claim), não por match automático de AFROLOC.** Como o código é partilhável por várias pessoas/entidades, ligar contas por códigos iguais seria incorreto e um risco de privacidade.
5. **Reputação de lugar via livro de eventos.** Eventos append-only alimentam a Kilapi; a leitura é restrita (não pública).

`⚠️ a validar`: o estado de implementação nas apps externas (Yamioo não deployado; claim e AFROLOC-ID de pessoa ainda por construir) vive nos respetivos repositórios e não é verificável a partir deste.

---

## 7. Changelog

| Versão | Data | Alterações |
|--------|------|-----------|
| 1.0.0 | 2026-07-08 | Versão inicial. Âmbito, apps do ecossistema, princípio "AFROLOC é lugar não pessoa", modelo de integração (contrato/chave/claim), webhooks e livro de eventos, decisões arquiteturais. Ancorado em `yamioo-gateway`, `webhook-dispatch`, `receive-webhook`, `manage-yamioo-agents` e `WEBHOOK_INTEGRATION.md`. |
