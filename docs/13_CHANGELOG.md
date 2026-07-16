# Manual 13 — Changelog / Notas de Versão

> **Versão do documento** 1.0.0 · **Data** 2026-07-08 · **Aplica-se a** app 1.0.0
> **Fonte da verdade:** `src/lib/version.ts` (deriva de `package.json`) + histórico `git`
> **Classificação:** Público (P)

Este documento é o **changelog global** da aplicação **AFROLOC**. Segue o formato
[Keep a Changelog](https://keepachangelog.com/) e a convenção
[Versionamento Semântico (SemVer)](https://semver.org/lang/pt-BR/).

A versão da app é definida **num único sítio** — o campo `version` do `package.json`,
lido por `src/lib/version.ts`. Para lançar 1.1 ou 2.0 muda-se **só lá**.

---

## 1. Convenção de versionamento

A app usa **SemVer**, no formato `MAJOR.MINOR.PATCH` (ex.: `1.0.0`).

| Segmento | Quando incrementa | Exemplo |
|----------|-------------------|---------|
| **MAJOR** | Alterações incompatíveis: mudança do algoritmo do endereço (codec), quebra de contratos de API, migração que obriga o utilizador a reagir. | `1.4.2` → `2.0.0` |
| **MINOR** | Novas funcionalidades compatíveis com o que já existe (nada deixa de funcionar). | `1.0.0` → `1.1.0` |
| **PATCH** | Correções de erros e ajustes internos, sem novas funcionalidades. | `1.0.0` → `1.0.1` |

**Regras práticas**

- A **MAJOR** é reservada, em especial, para qualquer mudança no **algoritmo de
  codificação do endereço AFROLOC** (codec). Endereços já emitidos têm de continuar
  a resolver; se isso não for garantido, é MAJOR.
- Cada linha do changelog descreve **o que muda para o utilizador**, não o commit técnico.
- Rótulos ao utilizador vêm de `version.ts` (ex.: `APP_VERSION_LABEL` = "Ver 1.0",
  `APP_FULL_LABEL` = "AFROLOC Ver 1.0").

**Relação com os documentos.** Os manuais desta pasta `docs/` são versionados **à parte**
(cada um tem o seu "Versão do documento"). Um documento indica sempre a que versão da
**app** se aplica (campo "Aplica-se a"). Assim:

- uma **PATCH** da app raramente mexe nos documentos;
- uma **MINOR** costuma acrescentar/rever secções nos manuais afetados;
- uma **MAJOR** obriga a rever transversalmente os documentos e a subir a sua versão.

---

## 2. [Não lançado]

_Alterações já em desenvolvimento, ainda sem número de versão atribuído._

### Adicionado
- **Biometria no browser (WebAuthn / passkeys) — Fase 1 (registo).** Início do suporte
  a autenticação por passkey em ambiente web. As fases seguintes (login por passkey,
  gestão de dispositivos) ficam para lançamentos futuros. ⚠️ número de versão a preencher.

### A definir
- Fases seguintes de biometria/WebAuthn (login, revogação de dispositivos).
- ⚠️ Restantes itens do próximo ciclo — _a preencher._

> Ao fechar um lançamento, mover as entradas desta secção para uma nova secção
> `[X.Y.Z] — AAAA-MM-DD`.

---

## 3. [1.0.0] — ⚠️ data de lançamento a preencher

Primeira versão pública da AFROLOC. Capacidades principais confirmadas no código:

### Adicionado
- **Endereçamento AFROLOC.** Criação e localização de endereços digitais para lugares
  sem morada formal, através do codec proprietário AFROLOC (ver `SPEC_CODEC_AFROLOC.md`).
- **Tipo de endereço Formal / Informal.** O utilizador indica o tipo (funciona online e
  offline); o tipo **Digital** só é atribuído por certificação.
- **ATS (verificação anti-spoofing do endereço).** Validação de posição para reduzir
  fraude de localização, com servidor autoritativo.
- **PoDP — Proof of Daily Presence.** Prova de presença diária, com consolidação (rollup)
  por cron diário.
- **Identidade + GPS.** Fluxo de "Criar Identidade" com captação de GPS e mensagens de
  erro claras; mapa de localização (`LocationMap`) corrigido.
- **Login por OTP (SMS).** Início de sessão por código enviado por SMS (Infobip), com
  mensagens reais de estado do envio e "Lembrar-me neste dispositivo" para login rápido.
- **Biometria WebAuthn (base).** Fundação para autenticação por passkey no browser
  (registo — Fase 1).
- **13 idiomas.** Interface multilíngue, com normalização do português para **pt-PT (Angola)**.
- **54 países** suportados no âmbito de cobertura.
- **Integração telecom / OpenCelliD.** Suporte a triangulação/identificação por célula
  para reforço de localização.

### Corrigido
- Mapa de localização a aparecer "preto" (contentor com altura 0).
- "Lembrar-me neste dispositivo" que nunca oferecia login rápido.
- Mensagens de envio de OTP no login (mostra a mensagem real, não o erro cru do SDK).

> ⚠️ **A data exata de lançamento da 1.0.0 não está registada no código nem no `git`
> disponível — preencher quando confirmada.**

---

## 4. Como reportar / registar alterações

**Para quem desenvolve (registar uma alteração):**

1. Enquanto desenvolve, acrescente a linha na secção **[Não lançado]**, na categoria certa:
   `Adicionado`, `Alterado`, `Corrigido`, `Depreciado`, `Removido`, `Segurança`.
2. Escreva a linha do ponto de vista do **utilizador** ("o quê" e "porquê"), não o detalhe técnico.
3. Ao **fechar um lançamento**: decida MAJOR/MINOR/PATCH (secção 1), atualize
   `package.json` (`version`), mova as entradas de [Não lançado] para uma nova
   secção `[X.Y.Z] — AAAA-MM-DD`, e reveja os manuais afetados.

**Para utilizadores (reportar um problema):**

- Indique a **versão da app** que está a usar — visível no rótulo "AFROLOC Ver 1.0"
  (proveniente de `version.ts`).
- Descreva o que fez, o que esperava e o que aconteceu; se possível, o país/idioma e
  o tipo de endereço (Formal/Informal/Digital).
- ⚠️ Canal oficial de reporte — _a preencher._
