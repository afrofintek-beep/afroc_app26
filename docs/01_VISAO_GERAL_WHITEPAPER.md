# Manual 1 — Visão Geral / Whitepaper AFROLOC

| Campo | Valor |
|---|---|
| **Versão do documento** | 1.0.0 |
| **Data** | 2026-07-08 |
| **Aplica-se a** | AFROLOC app `1.0.0` (`src/lib/version.ts`) |
| **Fonte da verdade** | `public/AFROLOC_DOCUMENTACAO_COMPLETA.md` · `public/HIERARCHICAL_SYSTEM.md` · `docs/SPEC_CODEC_AFROLOC.md` (resumo de alto nível apenas) |
| **Estado** | Estável |
| **Classificação** | **Público (P)** — não expõe o algoritmo interno do codec |

---

## 1. Âmbito e audiência

Este manual é o documento de entrada da documentação oficial da AFROLOC. Descreve, a alto nível, **o que é a AFROLOC, o problema que resolve e como o sistema funciona no seu todo**, sem entrar em detalhes de implementação.

**Audiência:** decisores, parceiros, autoridades, operadores de negócio, imprensa e qualquer pessoa que precise de entender o sistema antes de ler os manuais técnicos ou operacionais.

**Âmbito:**
- O problema do endereçamento em África.
- O conceito da AFROLOC e o modelo a alto nível (grelha geográfica + código digital + código postal).
- Os níveis de confiança de um endereço e a certificação pela autoridade.
- O ecossistema de apps ligadas pela mesma chave AFROLOC.
- Casos de uso principais.

**Fora de âmbito** (remetido para outros manuais): o algoritmo do codec, o cálculo do score de confiança, as regras anti-fraude, os fluxos administrativos e a integração técnica. Este documento é **público** e, por isso, **não revela o algoritmo interno** que converte coordenadas em código — apenas o conceito.

---

## 2. O problema

Em grande parte de África, o endereçamento formal (rua + número + código postal em uso corrente) **não existe ou não é utilizável na prática**. Isto cria barreiras concretas:

- **Entregas e logística** — estafetas dependem de indicações verbais, pontos de referência e chamadas telefónicas; não há um identificador estável do destino.
- **Banca e inclusão financeira** — a abertura de conta e o *KYC* exigem comprovativo de morada, que muitos cidadãos não conseguem fornecer.
- **Governo eletrónico e serviços públicos** — o Estado não consegue localizar de forma fiável cidadãos, propriedades e infraestruturas.
- **Comércio** — negócios informais não têm morada verificável para clientes, fornecedores ou plataformas digitais.

A raiz do problema é a **ausência de um identificador de localização único, estável e verificável** que funcione tanto em zonas formais como informais, e que possa ser usado offline em áreas com conectividade limitada.

---

## 3. O modelo AFROLOC

A AFROLOC é uma **plataforma digital de identificação e verificação de endereços físicos em África**. Atribui a cada localização um **código AFROLOC único**, que funciona como endereço digital independentemente de existir nomenclatura oficial no local.

### 3.1 Endereço digital sobre uma grelha geográfica

O código deriva de uma **grelha geográfica** que cobre o território e à qual cada ponto é atribuído:

- **Zona urbana:** célula de **~10 metros**.
- **Zona rural:** célula de **~25 metros**.
- Dentro de cada célula, o sistema aplica uma **subdivisão adaptativa por densidade** de registos, para distinguir endereços muito próximos.

> A precisão pública do endereço é a da célula da grelha (~10 m em zona urbana). O ponto público de um endereço é o **centro da célula**, e não o GPS bruto capturado. *(Resumo de alto nível; o algoritmo que gera o código é propriedade intelectual da Afrofintek e não é descrito neste manual.)*

### 3.2 Dois formatos de código

O código AFROLOC existe em **dois formatos que representam exatamente o mesmo ponto**:

1. **Formato compacto (endereço digital / código postal)** — identificador curto, adequado a locais sem divisões administrativas conhecidas.
2. **Formato com nomenclatura** — antepõe rótulos administrativos (país, província, município, comuna, bairro) quando estes são conhecidos, produzindo um código legível e enquadrado na hierarquia territorial.

Ambos os formatos decodificam para a mesma localização, pelo que um endereço pode ser expresso na forma mais adequada a cada contexto sem perder identidade.

### 3.3 Tipos de endereço

O sistema classifica os endereços conforme a informação disponível:

| Tipo | Descrição | Ciclo de verificação |
|---|---|---|
| **Formal** | Tem rua, número e código postal oficial | 365 dias |
| **Informal** | Tem rua e/ou número, sem código postal oficial | 180 dias |
| **Digital** | Apenas código AFROLOC e coordenadas | 90 dias |

### 3.4 Funcionamento offline

O sistema foi desenhado para funcionar em áreas com conectividade limitada: um código pode ser gerado **sem rede** e reconcilia com o servidor quando a ligação é restabelecida. Existe ainda um **modo de operador de campo** que permite registar endereços offline e sincronizar mais tarde.

---

## 4. Níveis de confiança

Nem todos os endereços têm o mesmo grau de fiabilidade. A AFROLOC atribui a cada endereço um **grau de confiança**, que evolua desde o simples **auto-declarado** até níveis progressivamente mais fortes de verificação.

Esse grau resulta de um **score de confiança (ATS — Address Trust Score, 0–100)**, alimentado por múltiplas fontes independentes de evidência:

| Fonte de evidência | Contributo |
|---|---|
| Coordenadas GPS | Validação de localização |
| Sinal telecom | Triangulação de torres celulares |
| Metadados da foto (EXIF) | Consistência da captura |
| Testemunhas | Confirmação comunitária |
| Auditoria | Documentos e vistorias |

### 4.1 Escala de confiança

O modelo conceptual de níveis de confiança progride de **auto-declarado → bronze → prata → ouro → platina**, correspondendo a evidência crescente e independente por trás do endereço.

> ⚠️ **a validar** — A nomenclatura *bronze / prata / ouro / platina* usada neste manual é a designação conceptual da escala de confiança. A implementação atual do código (`public/AFROLOC_DOCUMENTACAO_COMPLETA.md`, secção 7.2) expõe os níveis de certificação como: **Não Verificado (0–19)**, **Básico (20–39)**, **Verificado (40–59)**, **Certificado (60–79)** e **Premium (80–100)**. O mapeamento exato entre a escala conceptual (auto-declarado→platina) e estes cinco patamares deve ser confirmado antes da publicação.

### 4.2 Certificação pela autoridade

O nível mais alto de confiança envolve **certificação pela autoridade competente**. A AFROLOC opera sobre uma **hierarquia administrativa de 5 níveis** (nacional → provincial → territorial/municipal → comunal → local), em que cada nível pode validar e certificar endereços na sua jurisdição. A certificação por um validador ou administrador da autoridade eleva o endereço acima da mera validação comunitária, conferindo-lhe reconhecimento oficial.

---

## 5. Ecossistema

A AFROLOC não é uma app isolada: é a **camada de endereçamento** de um conjunto de aplicações da Afrofintek, todas ligadas pela **mesma chave AFROLOC** (o código único de endereço/identidade).

| App | Papel no ecossistema |
|---|---|
| **AFROLOC** | Cria, verifica e certifica o endereço; é a fonte da chave. |
| **Yamioo** | ⚠️ *a validar* — app do ecossistema que consome a chave AFROLOC. |
| **Yamilook** | ⚠️ *a validar* — app do ecossistema que consome a chave AFROLOC. |
| **Sumba** | ⚠️ *a validar* — app do ecossistema que consome a chave AFROLOC. |
| **Kilapi** | ⚠️ *a validar* — app do ecossistema que consome a chave AFROLOC. |

> ⚠️ **a validar** — O papel funcional específico de cada app (Yamioo, Yamilook, Sumba, Kilapi) e a forma exata como cada uma se liga à chave AFROLOC não estão descritos nos ficheiros-fonte deste manual. O princípio confirmado é: **as apps do ecossistema partilham a mesma chave AFROLOC como identificador comum de endereço/localização**, permitindo que um endereço verificado numa app seja reconhecido nas restantes.

---

## 6. Casos de uso

- **Entregas e logística** — um código AFROLOC identifica de forma estável o destino, substituindo indicações verbais e reduzindo entregas falhadas.
- **Banca e inclusão financeira** — um endereço verificado (com nível de confiança adequado) serve de comprovativo de morada para *KYC* e abertura de conta, incluindo cidadãos em zonas informais.
- **Governo eletrónico e serviços públicos** — o Estado passa a poder localizar cidadãos, propriedades e infraestruturas com um identificador único e certificável pela própria autoridade.
- **Comércio** — negócios informais ganham uma morada digital verificável, utilizável por clientes, fornecedores e plataformas do ecossistema.

Em todos os casos, o valor está na combinação de **identificador único + nível de confiança + certificação pela autoridade**, reutilizável por qualquer app ligada pela chave AFROLOC.

---

## 7. Changelog

| Versão | Data | Alteração |
|---|---|---|
| 1.0.0 | 2026-07-08 | Versão inicial do Manual 1 (Visão Geral / Whitepaper), ancorada em `AFROLOC_DOCUMENTACAO_COMPLETA.md`, `HIERARCHICAL_SYSTEM.md` e no resumo público de `SPEC_CODEC_AFROLOC.md`. |
