# SPEC · Registo de campo do POTENCIAL UTILIZADOR + Validação (fiscalização)

> Estado: **RASCUNHO / decisão pendente** · Data: 2026-08-02 (rev. 2, alinhada à visão do dono)
> Modelo: o registo de endereços é **trabalho de campo para outras pessoas**. Os
> dados do **potencial utilizador** são inseridos no app (pendentes) e o
> **validador** faz **fiscalização, acompanhamento e validação** — não é dono nem
> o registante. Separam-se dois atos: (1) captura de dados no terreno,
> (2) fiscalização + validação.

---

## 1. Princípio

O endereço pertence **sempre ao potencial utilizador**, nunca a quem o insere
nem ao validador. O validador é um papel de **fiscalização/acompanhamento** que
**valida** (certifica) registos pendentes na sua jurisdição.

Dois atos distintos:
1. **Captura (campo):** inserir os dados do potencial utilizador → cria um
   **registo pendente** associado a esse potencial utilizador.
2. **Fiscalização + validação:** o validador revê, acompanha e **valida**
   (certifica nível 4) os registos pendentes da sua jurisdição.

Mais tarde, o potencial utilizador **ativa/reivindica** a sua conta e passa a
gerir a sua morada.

---

## 2. Conceito central: "POTENCIAL UTILIZADOR"

Uma **identidade pendente** captada no terreno, para alguém que (ainda) não tem
conta. Guarda o mínimo para identificar e mais tarde ativar:
- nome, contacto (telefone), `occupancy_title` (proprietário/arrendatário),
- a morada AFROLOC (localização/célula, foto da porta, EXIF),
- estado inicial **pendente** (não certificado, não descobrível).

### Posse do registo
Como `afroloc_records.user_id` é obrigatório (`NOT NULL`), enquanto o potencial
utilizador não tiver conta o registo fica em posse **transitória** de uma conta
de sistema (`autoridade@afroloc.ao`, já existe), com:
- `registered_by_user_id` = quem capturou no terreno (agente/validador);
- dados do potencial utilizador em `metadata` (nome, telefone, occupancy);
- marca de **reclamável** (pré-autorização por telefone) para ativação posterior.

Alternativa a decidir (§6): criar uma **identidade-placeholder por potencial
utilizador** em vez da conta de autoridade única.

---

## 3. Fluxo ponta-a-ponta

```
CAMPO (captura)                         VALIDADOR (fiscalização)         POTENCIAL UTILIZADOR
──────────────                          ────────────────────────        ────────────────────
inserir dados do potencial   ──►  registo PENDENTE  ──►  revê/acompanha na  ──►  certificado
utilizador (nome, contacto,       (dono transitório =    sua jurisdição e         (nível 4)
localização, foto)                autoridade; reclamável) VALIDA (certifica)   ──►  ATIVA/reivindica
                                                                                    a conta e assume
                                                                                    a morada
```

- A **captura** não certifica — só cria o pendente.
- A **validação** é o ato do validador (já existe: `validator_certify_address`,
  limitado à jurisdição — ver Belas no caso de teste).
- A **ativação** usa o resgate já construído (`afroloc_preauthorizations` +
  `redeem_afroloc_authorization`): o potencial utilizador reivindica e a posse
  transita da autoridade para ele.

---

## 4. Estado atual vs. o que falta

**Problema atual (`CreateIdentity.tsx:572-573`):** ao registar, o insert faz
`user_id = ... : user.id` e `registered_by_user_id = isYamiooAgent ? user.id : null`.
Como o validador não é `yamioo_agents`, cai no else → **fica ele dono** e sem
rasto. Errado para trabalho de campo.

**O que já existe (reutilizar):**
- `afroloc_records.registered_by_user_id` (quem capturou).
- Conta de sistema `autoridade@afroloc.ao` (posse transitória).
- Resgate: `afroloc_preauthorizations` + `redeem_afroloc_authorization` / `check_afroloc_authorization`.
- `occupancy_title` em `metadata`.
- Fluxo "em nome de" dos agentes Yamioo (`isYamiooAgent` + `RequesterLookup`) — a generalizar.
- Certificação por jurisdição do validador (`validator_certify_address`).

**O que falta construir:**
1. **Ecrã/fluxo de captura do potencial utilizador** (campo): formulário que
   grava dono = autoridade, `registered_by_user_id` = capturador, dados em
   metadata, estado pendente, e cria a pré-autorização de resgate pelo telefone.
2. **Painel de fiscalização/acompanhamento do validador:** listar os registos
   **pendentes da sua jurisdição**, com acompanhamento, e validar em lote/por
   código (já há a certificação por código).
3. **Ativação pelo potencial utilizador:** ecrã de resgate por telefone/OTP que
   transfere a posse da autoridade para o utilizador.
4. **Rede de segurança:** impedir que um capturador/validador fique `user_id` de
   um registo com `registered_by_user_id` preenchido (nunca dono do que registou
   para outro).

---

## 5. Papéis

- **Agente de campo (capturador):** insere os dados do potencial utilizador.
  Pode ser o mesmo papel `operator_field` ou um papel de captura dedicado
  (decisão §6). Fica em `registered_by_user_id`, nunca dono.
- **Validador (fiscalização/acompanhamento):** revê os pendentes da jurisdição,
  acompanha e **valida** (certifica). É o "fiscal", separado da captura.
- **Potencial utilizador:** dono lógico desde o início (dados no registo);
  torna-se dono efetivo ao **ativar/reivindicar**.

---

## 6. Decisões em aberto (para o dono)
- **Posse transitória:** conta de autoridade única (`autoridade@afroloc.ao`)
  **ou** identidade-placeholder por potencial utilizador?
- **Captura vs validação — mesmo papel?** o `operator_field` faz as duas coisas,
  ou separamos "capturador de campo" (regista) de "validador" (fiscaliza/valida)
  para haver segregação de funções na fiscalização?
- **Ativação:** por OTP/telefone (o potencial utilizador confirma e assume) — que
  prova exigir? E se a pessoa nunca ativar, quanto tempo fica sob a autoridade?
- **Consentimento na captura:** que consentimento do potencial utilizador é
  registado no terreno (assinatura, foto, OTP no momento)?
- **Limites anti-abuso:** registos/dia por capturador antes de revisão.

---

## 7. Resumo
Trabalho de campo = **captura dos dados do potencial utilizador** (pendente, em
nome dele, posse transitória da autoridade). O **validador** faz
**fiscalização + validação**, não é dono nem registante. O potencial utilizador
**ativa** depois e assume a morada. A maioria das peças existe; falta o ecrã de
captura, o painel de fiscalização dos pendentes por jurisdição, a ativação por
resgate, e a rede de segurança que impede o capturador/validador de ficar dono.
