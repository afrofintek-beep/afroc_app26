# Plano-Mestre de Documentação — AFROLOC

| Campo | Valor |
|---|---|
| **Versão do documento** | 1.0.0 |
| **Data** | 2026-07-08 |
| **Aplica-se a** | AFROLOC app `1.0.0` |
| **Estado** | Vivo — atualizado a cada manual publicado |
| **Classificação** | Interno |

Documento que define **a estrutura completa da documentação** do AFROLOC: que manuais existem, para quem, onde vivem, como se versionam e por que ordem se produzem. Cada manual segue o **template** da §4 e o **versionamento** da §5.

---

## 1. Objetivo

Dar a um projeto desta dimensão e responsabilidade um corpo documental **completo, exato (ancorado no código), versionado e multi-audiência**. Regra de ouro: **a documentação reflete o sistema real** — onde uma afirmação não pode ser verificada no código ou ao vivo, é marcada `⚠️ a validar`, nunca apresentada como facto.

---

## 2. Catálogo dos manuais

Classificação: **P** = público · **I** = interno · **C** = confidencial (IP/segurança).
Local: `public/` = servido na app (só P) · `docs/` = repo, não servido (I/C).

| Nº | Manual | Audiência | Classe | Local | Estado |
|---|---|---|---|---|---|
| 1 | **Visão Geral / Whitepaper** | Todos | P | public/ | ☐ por criar |
| 2 | **Especificação do Codec** | Eng./auditoria | **C** | docs/ | ✅ v1.0.0 (`SPEC_CODEC_AFROLOC.md`) |
| 3 | **Manual do Utilizador** | Cidadãos/negócios | P | public/ | ☐ por criar |
| 4 | **Manual do Administrador** | Admin municipal/nacional | I | docs/ | ◐ parcial (falta base) |
| 5 | **Segurança & Anti-fraude** (ATS, PoDP, GPS/EXIF, risk) | Segurança/auditoria | **C** | docs/ | ☐ por criar |
| 6 | **Arquitetura do Sistema** | Dev | I | docs/ | ◐ parcial |
| 7 | **Referência de API** (edge functions) | Integradores | I | docs/ | ◐ parcial |
| 8 | **Divisões Administrativas & Autoridades** (54 países) | Admin/instituições | P | public/ | ◐ parcial |
| 9 | **i18n** (13 idiomas, processo de validação) | Equipa/tradutores | I | docs/ | ◐ parcial |
| 10 | **Operações / Runbook** (deploy, cron PoDP, Vault, monitorização) | Ops | **C** | docs/ | ☐ por criar |
| 11 | **Conformidade & Proteção de Dados** ⚠️ validação jurídica | Legal/compliance | I | docs/ | ☐ por criar |
| 12 | **Integração do Ecossistema** (Yamioo/Yamilook/Sumba/Kilapi) | Parceiros | I | docs/ | ☐ por criar |
| 13 | **Changelog / Notas de Versão** | Todos | P | public/ | ☐ por criar |

---

## 3. Auditoria do que existe hoje

Ficheiros em `public/` (servidos pela página `/manual-download`):

| Ficheiro | Mapeia para | Ação |
|---|---|---|
| `AFROLOC_DOCUMENTACAO_COMPLETA.md` | (all-in-one) | **Dividir** pelos manuais estruturados; manter como resumo até à migração |
| `HIERARCHICAL_SYSTEM.md` | Manual 6 (Arquitetura) | Absorver/atualizar |
| `AUTHORIZATION_SYSTEM.md` | Manual 6 (Arquitetura) | Absorver/atualizar |
| `TRANSLATION_VALIDATION.md` | Manual 9 (i18n) | Absorver/atualizar |
| `CAMERA_PERMISSIONS.md` | Manual 10 (Operações — anexo) | Mover para anexo |
| `WEBHOOK_INTEGRATION.md` | Manual 7 (API) / 12 (Ecossistema) | Absorver |
| `TELECOM_DATA_REQUEST_TEMPLATE.md` | Manual 8 (anexo — dados telecom) | Mover para anexo |
| `MANUAL_DE_APOIO.md` | Manual 4 (Administrador) | **FALTA no deploy (untracked)** → criar/comprometer |

**Bugs da página de docs a corrigir** (Manual 4 / wiring):
1. **"Ver"** faz `window.open('/x.md')` → abre Markdown **cru**. Substituir por **viewer que renderiza** o Markdown na app.
2. **`MANUAL_DE_APOIO.md`** untracked → o 1.º card dá **404**. Criar o ficheiro e comprometê-lo.

**Novo:** `docs/SPEC_CODEC_AFROLOC.md` (Manual 2) — confidencial, **fora de `public/`**.

---

## 4. Template comum (cada manual segue isto)

```
# <Título do Manual>

[ Bloco de metadados: Versão do documento | Data | Aplica-se a (app X.Y.Z)
  | Fonte da verdade (ficheiros/tabelas) | Estado | Classificação ]

1. Âmbito e audiência        — o que cobre, para quem, o que fica de fora
2. Conceitos / Modelo        — o essencial antes do detalhe
3. Conteúdo (secções N)      — o detalhe, ancorado no código real
4. Exemplos trabalhados      — pelo menos um caso real ponta-a-ponta
5. Referências cruzadas      — outros manuais/ficheiros
6. Glossário                 — quando aplicável
7. Changelog                 — histórico de versões do documento
```

Regras de escrita: afirmações rastreáveis ao código; `⚠️ a validar` no que não é verificável; sem jargão desnecessário; PT como língua base (EN/FR para os manuais 1, 3, 8, 13 quando internacionalizados).

---

## 5. Versionamento

- **SemVer** por documento (`MAJOR.MINOR.PATCH`):
  - **MAJOR** — mudança que quebra (formato, algoritmo, contrato de API).
  - **MINOR** — nova secção/funcionalidade documentada.
  - **PATCH** — correções, clarificações.
- Cada manual declara **"Aplica-se a"** a versão da app (`src/lib/version.ts`). Um manual pode evoluir independentemente da app, mas indica sempre a que versão da app corresponde.
- **Changelog** obrigatório no fim de cada manual + um **Manual 13 (Changelog global)** que agrega releases da app.
- **Git** é o histórico: cada alteração relevante vai num commit; releases marcam-se com tag (`docs-vX.Y.Z` ou junto do release da app). Docs confidenciais vivem só no repo privado, nunca em `public/`.

---

## 6. Onde vivem e como são servidos

- **`docs/`** (repo `afroc_app26`, privado) — manuais **I/C**. Não servidos ao público.
- **`public/`** — apenas manuais **P** (Visão Geral, Utilizador, Divisões, Changelog). São estes que a página `/manual-download` lista e descarrega.
- **Regra inviolável:** nada confidencial (Codec, Segurança, Runbook/segredos) em `public/`.
- **Página de docs:** corrigir os 2 bugs da §3 e passar a listar **só os manuais P**; os I/C ficam no repo para a equipa.

---

## 7. Roteiro de produção (ordem sugerida)

Prioridade por valor × risco:

1. **Manual 5 — Segurança & Anti-fraude** (ATS + PoDP + anti-spoofing) — núcleo de responsabilidade; confidencial.
2. **Manual 3 — Utilizador** — desbloqueia adoção; público.
3. **Manual 4 — Administrador** (+ corrigir os bugs da página e o `MANUAL_DE_APOIO.md`).
4. **Manual 6 — Arquitetura** (absorve HIERARCHICAL + AUTHORIZATION).
5. **Manual 7 — API** (edge functions).
6. **Manual 8 — Divisões & Autoridades** (54 países).
7. **Manual 1 — Whitepaper/Visão Geral** (após os núcleos, para ficar sólido).
8. **Manuais 9–13** conforme necessidade.

Cada manual: escrevo a partir do código → tu revês → ajusto → versão fechada.

---

## 8. Changelog

| Versão | Data | Alteração |
|---|---|---|
| 1.0.0 | 2026-07-08 | Plano inicial: catálogo dos 13 manuais, template, versionamento, auditoria do existente, roteiro. Manual 2 (Codec) já produzido. |
