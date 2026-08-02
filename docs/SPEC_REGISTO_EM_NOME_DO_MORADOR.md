# SPEC · Registo de endereço EM NOME DO MORADOR (validador / agente de terreno)

> Estado: **RASCUNHO / decisão pendente** · Autor: análise técnica · Data: 2026-08-02
> Contexto: um validador (`operator_field`) regista endereços de pessoas que
> muitas vezes não conseguem fazê-lo. Hoje o registo atribui a posse a **quem
> está a registar** — ou seja, ao validador. Este documento descreve o problema
> e o desenho correto para que a morada pertença sempre ao **morador**.

---

## 1. Problema (comportamento atual)

Um endereço AFROLOC está **sempre associado a um dono** (`afroloc_records.user_id`
é obrigatório — `NOT NULL`). Existe já um mecanismo de "registar em nome de
outro", mas está **preso aos agentes Yamioo** e não cobre o validador:

`src/pages/CreateIdentity.tsx` (linhas ~572-573):
```ts
user_id: isYamiooAgent && selectedRequester ? selectedRequester.user_id : user.id,
registered_by_user_id: isYamiooAgent ? user.id : null,
```

- `isYamiooAgent` só é verdadeiro se a conta existir na tabela `yamioo_agents`
  (`CreateIdentity.tsx:237-243`).
- O **validador** (`operator_field`) **não está** em `yamioo_agents` → cai no
  ramo `else` → **`user_id = o próprio validador`** e `registered_by_user_id = null`.
- Mesmo o ramo Yamioo exige que o morador **já tenha conta**: o `RequesterLookup`
  (`src/components/RequesterLookup.tsx`) procura um perfil existente por telefone
  (edge function `lookup-requester`).

### Consequências
1. **O validador fica dono** das moradas dos outros → a contagem pessoal dele
   infla (o mesmo problema resolvido nas âncoras-génese, movidas para
   `autoridade@afroloc.ao`).
2. O **verdadeiro morador não é dono** do seu endereço.
3. `registered_by_user_id` — o campo desenhado exatamente para "quem registou por
   conta de quem" — fica a `null`, apagando o rasto.
4. Parte o modelo "1 residência por titular".

---

## 2. Desenho correto

**Princípio:** a morada pertence ao **morador**; o validador é apenas
**"quem registou"** (`registered_by_user_id`). O validador **nunca** deve ficar
como `user_id` de uma morada que não é dele.

Dois casos, consoante o morador tenha ou não conta:

### Caso A — o morador JÁ tem conta
- Procurar o morador (reutilizar o padrão `RequesterLookup`, por telefone/nome).
- `user_id = morador.user_id`
- `registered_by_user_id = validador`
- Requer consentimento/verificação do morador (ver §4).

### Caso B — o morador NÃO tem conta (o caso comum no terreno)
- Registar como **reclamável (claimable)**:
  - **dono transitório** = conta de autoridade **`autoridade@afroloc.ao`**
    (já existe) — OU uma identidade-placeholder criada com o nome/telefone do
    morador (a decidir, ver §5).
  - `registered_by_user_id = validador`
  - dados do morador (nome, telefone, `occupancy_title`) em `metadata`.
  - marca de "reclamável" (ex.: pré-autorização por telefone).
- Mais tarde, o morador **reivindica** a morada usando o padrão já construído:
  `afroloc_preauthorizations` + RPC `redeem_afroloc_authorization`
  (ver `docs/` das âncoras-génese e o modelo de titular do agregado).

---

## 3. Peças que JÁ existem (reutilizar, não reinventar)
- Campo `afroloc_records.registered_by_user_id`.
- Conta de sistema `autoridade@afroloc.ao` (posse transitória).
- Fluxo de resgate: tabela `afroloc_preauthorizations` + RPC
  `authority_preauthorize_address` / `redeem_afroloc_authorization` /
  `check_afroloc_authorization`.
- `occupancy_title` (`owner` / `tenant` / `other`) em `metadata`.
- Fluxo "em nome de" dos agentes Yamioo (`isYamiooAgent` + `selectedRequester`)
  — a **generalizar** para `operator_field`.
- `RequesterLookup` + edge function `lookup-requester`.

---

## 4. Pontos de implementação (quando se decidir avançar)
1. **`CreateIdentity.tsx`**
   - Alargar a deteção de "agente" a `operator_field` (não só `yamioo_agents`).
     Ex.: `const isOnBehalf = isYamiooAgent || isAddressValidator;`
   - Mostrar o `RequesterLookup` também para validadores.
   - No insert: `user_id = morador (ou autoridade se sem conta)`,
     `registered_by_user_id = user.id` sempre que `isOnBehalf`.
2. **Caso B (sem conta):** ao registar, criar a pré-autorização de resgate para o
   telefone do morador e definir dono = `autoridade@afroloc.ao`.
3. **Enforcement (rede de segurança):** um trigger/regra que **impeça** um
   `operator_field` de ficar `user_id` de um registo com `registered_by_user_id`
   preenchido (ou seja, registou por conta de outro mas ficou dono).
4. **Jurisdição:** o registo por validador deve continuar limitado à sua
   jurisdição (Belas, no caso), como já acontece na certificação
   (`validator_certify_address`).
5. **i18n:** textos novos (procurar morador, sem conta → reclamável, etc.).

---

## 5. Decisões em aberto (para o dono)
- **Caso B — dono transitório:** conta de autoridade única
  (`autoridade@afroloc.ao`) **ou** identidade-placeholder por morador?
  (a placeholder é mais fiel mas cria "meias-contas" a gerir).
- **Consentimento (Caso A):** exigir OTP/aprovação do morador antes de o validador
  criar em nome dele? (evita registos à revelia).
- **Verificação de morada real:** o validador certifica (nível 4) — deve poder
  registar E certificar no mesmo passo, ou são ações separadas (registar →
  certificar por código, como hoje)?
- **Limites anti-abuso:** quantos registos/dia por validador antes de revisão?

---

## 6. Resumo
Hoje o validador registaria a morada **como se fosse dele** — está errado. O
desenho correto atribui a posse ao **morador** (conta própria ou resgate
posterior) e regista o validador apenas em `registered_by_user_id`. A maioria das
peças já existe; falta ligá-las ao papel `operator_field` e adicionar a rede de
segurança que impede o validador de ficar dono.
