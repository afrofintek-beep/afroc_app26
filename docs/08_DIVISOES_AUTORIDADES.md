# Manual 8 — Divisões Administrativas & Autoridades

| | |
|---|---|
| **Versão do documento** | 1.0.0 |
| **Data** | 2026-07-08 |
| **Aplica-se a** | AFROLOC app 1.0.0 |
| **Estatuto** | Fonte da verdade |
| **Classificação** | Público (P) |

> Documento público. Descreve o modelo de divisões administrativas dos 54 países africanos usado pelo AFROLOC, a nomenclatura de nível 1 por país, as línguas oficiais e como a hierarquia administrativa alimenta a nomenclatura do endereço. Todas as afirmações estão ancoradas nos dados e no código do repositório. Onde algo não pôde ser confirmado diretamente, está marcado com `⚠️ a validar`.

---

## 1. Âmbito

Este manual cobre a **camada de referência continental** do AFROLOC — os dados que definem *que países existem*, *como se chama o primeiro nível de divisão em cada país* e *como essas divisões se encaixam no código de endereço*. Especificamente:

- O modelo de dados dos **54 países africanos** e das suas **834 unidades de nível 1** (província / wilaya / departamento / concelho…).
- As **línguas oficiais e faladas** por país.
- Como país / província / município / comuna / bairro se mapeiam aos segmentos do código de endereço no **formato de nomenclatura** `CC-PROV-MUN-COM-BAI-…`.
- O caso de **Angola** em detalhe (21 províncias; municípios e comunas segundo a reforma de 2024).
- O conceito de **autoridade emissora** do certificado por país — `⚠️ a validar` (ver secção 6).

**Fontes da verdade neste manual:**

- Tipos e acessores: `src/data/africaAdmin.ts` (interfaces `Country`, `AdminUnit`, `AfricaAdmin`).
- Dados de referência: `src/data/africa-admin.json` (`meta` + `paises[]`).
- Configuração por país na app: `src/utils/countryConfig.ts` (`COUNTRIES`, `getCountryByCode`).
- Resolução hierárquica em runtime: `src/hooks/useAdminDivisionResolver.ts` e `src/pages/CreateIdentity.tsx`.
- Formato do código: `src/utils/yamiooIntegrationPdf.ts` e `src/pages/GridSystemPDF.tsx`.
- Semente da base de dados: `africa-admin-seed.sql` (tabela `unidade_admin` / `administrative_divisions`).

> **Aviso da própria fonte de dados** (campo `meta.aviso` em `africa-admin.json`):
> *"Nomes/contagens de nível 1 a validar com fonte oficial (GADM/HDX) antes de produção. Profundidade até bairro só em Angola."*
> Ou seja, a app assume que apenas **Angola** tem profundidade abaixo do nível 1 nos dados de referência incluídos; os restantes tiers dos outros países entram por importação nacional. `⚠️ a validar` para nomes e contagens exatos de cada país.

---

## 2. Modelo de divisões (54 países)

### 2.1 Estrutura de dados

O ficheiro `africa-admin.json` tem a forma (interface `AfricaAdmin` em `africaAdmin.ts`):

```ts
interface AfricaAdmin {
  meta: {
    fonte: string;              // "AfroFinTek — nível 1 + línguas"
    aviso: string;              // ver secção 1
    n_paises: number;           // 54
    n_unidades_nivel1: number;  // 834
    n_bairros_piloto: number;   // 80
  };
  paises: Country[];
}

interface Country {
  iso: string;                  // ISO 3166-1 alpha-2, ex.: "AO"
  pais: string;                 // "Angola"
  flag: string;                 // "🇦🇴"
  capital: string;              // "Luanda"
  nivel1_tipo: string;          // "província", "wilaya", "departamento"…
  linguas_oficiais: string[];   // ["Português"]
  linguas_faladas?: string[];   // ["Umbundu", "Kimbundu", …]
  nivel1: AdminUnit[];          // as unidades de 1.º nível
}

interface AdminUnit {
  nome: string;                 // "Luanda"
  nome_norm: string;            // "luanda" (sem acentos, minúsculas)
  codigo: string;               // "LUA" — usado no segmento do código
}
```

### 2.2 Metadados confirmados

Valores lidos diretamente de `meta` em `africa-admin.json`:

| Métrica | Valor |
|---|---|
| Países (`n_paises`) | **54** |
| Unidades de nível 1 (`n_unidades_nivel1`) | **834** |
| Bairros piloto (`n_bairros_piloto`) | **80** |
| Fonte declarada | AfroFinTek — nível 1 + línguas |

A contagem de 834 confirma-se somando `nivel1.length` de todos os países (função `totalLevel1()` em `africaAdmin.ts`). O número de unidades por país varia de **3** (Comores) a **58** (Argélia).

### 2.3 Profundidade da hierarquia

Os dados de referência incluídos (`africa-admin.json`) chegam **apenas ao nível 1** — cada país é uma lista plana das suas unidades de 1.º nível, sem filhos aninhados. A única profundidade adicional embarcada é a dos **bairros piloto** semeados em `africa-admin-seed.sql` para cidades-âncora (Luanda, Maputo, Acra, Praia, Nairobi), marcados no próprio SQL como *"Escritos à mão — VALIDAR"*.

O modelo lógico completo, porém, é de **5 níveis** (ver Manual 6 e `HIERARCHICAL_SYSTEM.md`):

```
Nível 5  Nacional     (país)
Nível 4  Provincial   (província / estado / região …)
Nível 3  Territorial  (município / território)
Nível 2  Comunal      (comuna / distrito)
Nível 1  Local        (bairro / quartier)
```

Na base de dados operacional (`administrative_divisions`), cada divisão tem `country_code`, `level` (1=província, 2=território/município, 3=comuna, …), `code`, `name` e `parent_code`, formando a árvore. Fora de Angola, esses tiers intermédios entram por **importação nacional** (geoBoundaries ADM1-3 + OSM, conforme nota em `africa-admin-seed.sql`) — não vêm embarcados. `⚠️ a validar` para a cobertura efetiva de cada país.

---

## 3. Nomenclatura por país

O campo `nivel1_tipo` guarda **como se chama o primeiro nível de divisão** em cada país. A app usa este rótulo para etiquetar seletores e para compor o segmento `PROV` do código. Há **16 variantes distintas** de nomenclatura nos 54 países:

| `nivel1_tipo` | N.º de países | Exemplos (país · ISO · n.º de unidades) |
|---|---|---|
| região | 17 | Burquina Faso · BF · 13 · · Camarões · CM · 10 · · Djibuti · DJ · 6 |
| província | 12 | Angola · AO · 21 · · Burúndi · BI · 18 · · Chade · TD · 23 · · RD Congo · CD · 26 |
| distrito | 7 | Botsuana · BW · 10 · · Costa do Marfim · CI · 14 · · Lesoto · LS · 10 · · Maláui · MW · 28 |
| estado | 3 | Nigéria · NG · 37 · · Sudão · SD · 18 · · Sudão do Sul · SS · 10 |
| departamento | 2 | Benim · BJ · 12 · · Congo · CG · 12 |
| governadoria | 2 | Egito · EG · 27 · · Tunísia · TN · 24 |
| condado | 2 | Quénia · KE · 47 · · Libéria · LR · 15 |
| província (wilaya) | 1 | Argélia · DZ · 58 |
| concelho (município) | 1 | Cabo Verde · CV · 22 |
| prefeitura | 1 | República Centro-Africana · CF · 17 |
| ilha | 1 | Comores · KM · 3 |
| região (zoba) | 1 | Eritreia · ER · 6 |
| estado regional | 1 | Etiópia · ET · 14 |
| área de governo local | 1 | Gâmbia · GM · 8 |
| distrito (shabiyah) | 1 | Líbia · LY · 22 |
| região (wilaya) | 1 | Mauritânia · MR · 15 |

*(Distribuição derivada diretamente de `africa-admin.json`; contagens de unidades por país `⚠️ a validar` contra fonte oficial, conforme aviso da própria fonte.)*

### 3.1 Línguas

Cada país traz `linguas_oficiais` (obrigatório) e `linguas_faladas` (opcional). Nos dados atuais, **os 54 países têm ambos os campos preenchidos**. Exemplo de Angola:

- `linguas_oficiais`: `["Português"]`
- `linguas_faladas`: `["Umbundu", "Kimbundu", "Kikongo", "Chokwe", "Nganguela", "Kwanyama", "Fiote", "Luvale"]`

Estas listas alimentam a escolha de idioma e a apresentação por país. Note-se que o **idioma de interface** por país é definido separadamente em `src/utils/countryConfig.ts` (campo `language`, ex.: `pt` para Angola, `fr` para o Benim, `ar` para a Argélia), enquanto `linguas_*` em `africa-admin.json` é a lista informativa/cultural completa.

---

## 4. Mapeamento aos segmentos do código

O AFROLOC aceita **dois formatos** de código, ambos documentados em `src/utils/yamiooIntegrationPdf.ts` e `src/pages/GridSystemPDF.tsx`:

### 4.1 Formato padrão (geoespacial)

```
CC-ZT-Gnn-Xxxxx-Yyyyy
Exemplo: AO-ZU-G10-X35O8-YN247T
```

- `CC` — código do país (ISO 3166-1, ex.: `AO`)
- `ZT` — tipo de zona: `ZU` (urbana, grelha 10 m) ou `ZR` (rural, grelha 25 m)
- `Gnn` — tamanho da célula em metros (`G10` ou `G25`)
- `X/Y` — coordenadas Web Mercator em Base-36 (prefixo `N` = negativo)

### 4.2 Formato de nomenclatura (com hierarquia administrativa)

Insere a hierarquia administrativa entre o país e a grelha:

```
CC-PROV-MUN-COM-BAI-Gnn-Xxxxx-Yyyyy
Exemplo: AO-LUA-BEL-TAL-CAM-G10-X35O8-YN247T
```

**Legenda (de `yamiooIntegrationPdf.ts`, `bullet` "PROV/MUN/COM/BAI"):**

| Segmento | Nível lógico | Origem do valor | Exemplo |
|---|---|---|---|
| `CC` | Nacional (país) | `Country.iso` | `AO` |
| `PROV` | Provincial (nível 1) | `AdminUnit.codigo` da província | `LUA` (Luanda) |
| `MUN` | Territorial (município) | `code` da divisão de nível 2 | `BEL` (Belas) |
| `COM` | Comunal (comuna) | `code` da divisão de nível 3 | `TAL` (Talatona) |
| `BAI` | Local (bairro / quartier) | `code` do bairro | `CAM` |

O valor de cada segmento é o campo `codigo`/`code` da unidade (ex.: `LUA`, `ING`), **não** o nome por extenso — ver `AdminUnit.codigo` em `africaAdmin.ts` e a semente em `africa-admin-seed.sql`. Um exemplo mais curto documentado em `GridSystemPDF.tsx`:

```
AO-LUA-ING-ING-G10-X35O8-YN247T
  LUA = Província (Luanda)
  ING = Município (Ingombota)
  ING = Comuna (Ingombota)
```

### 4.3 Como a app resolve os segmentos

No ecrã de criação de endereço (`src/pages/CreateIdentity.tsx` + `useAdminDivisionResolver.ts`), a hierarquia é preenchida a partir das coordenadas GPS:

1. A app chama `resolve-zone` (urbano/rural + tamanho da grelha) e o Mapbox reverse-geocoding.
2. Faz correspondência dos nomes de lugar contra a tabela `administrative_divisions` local, resolvendo `level1` (província), `level2` (município), `level3` (comuna) e `level4` (quartier).
3. Os `code` resolvidos preenchem os seletores encadeados: escolher país → carrega províncias; escolher província → carrega municípios (`parent_code = província`) e comunas.

**Endereço "informal" vs "formal"** (`CreateIdentity.tsx`): o tipo informal usa o caminho de código **sem rua** (bairro `DIG`); o formal usa a rua/número indicados. O tipo é escolhido pelo utilizador.

---

## 5. Angola em detalhe

Angola é o país-âncora e o único com profundidade abaixo do nível 1 nos dados de referência embarcados.

### 5.1 Nível 1 — 21 províncias

De `africa-admin.json` (país `AO`):

- `pais`: Angola · `flag`: 🇦🇴 · `capital`: Luanda
- `nivel1_tipo`: **província**
- `nivel1.length`: **21**
- Cada província é um `AdminUnit` `{ nome, nome_norm, codigo }`, ex.: `{ "nome": "Benguela", "nome_norm": "benguela", "codigo": "BENG" }`.

As 21 províncias refletem a divisão em vigor (a reforma administrativa de 2024 elevou o país a 21 províncias). `⚠️ a validar` a lista nominal completa contra fonte oficial.

### 5.2 Níveis abaixo — municípios e comunas

Segundo a memória do projeto e a semente/BD, Angola tem **326 municípios** e **378 comunas** (reforma de 2024, Lei 14/24), com nomes revistos. Estes tiers **não** estão em `africa-admin.json` (que só tem nível 1) — vivem na tabela `administrative_divisions` (semeada por `africa-admin-seed.sql` e importação nacional). `⚠️ a validar` as contagens exatas contra o SQL/BD de produção, pois este manual não as conta linha a linha.

**Particularidade das comunas 2024** (comentário em `src/pages/CreateIdentity.tsx`, função `loadCommunes`):

> *As comunas da reforma de 2024 (Lei 14/24) estão registadas com `parent = PROVÍNCIA` — o Anexo I da lei lista as comunas por província; o mapeamento comuna→município só existe nos mapas-imagem e será afinado depois via OCR. Por isso a app filtra as comunas por província, não por município.*

Consequência prática: no seletor, ao escolher uma província carregam-se **municípios** (`level 2`, `parent_code = província`) **e** comunas (`level 3`, `parent_code = província`) em paralelo. O elo comuna→município ainda não está estabelecido nos dados. `⚠️ a validar` — mapeamento pendente.

### 5.3 Bairros piloto de Luanda

`africa-admin-seed.sql` semeia bairros piloto de Luanda como nível 2 sob a unidade-âncora "Luanda" (16 bairros escritos à mão, marcados "VALIDAR"), incluindo Talatona (`TAL`), Ingombota (`ING`), Maianga (`MAI`), Alvalade (`ALV`), Rangel (`RAN`), Sambizanga (`SAMB`), Kilamba Kiaxi (`KIL`), Prenda (`PRE`), entre outros. Estes `codigo` são os que aparecem no segmento `BAI` do código de nomenclatura.

---

## 6. Autoridade emissora por país (a validar)

O AFROLOC prevê que um endereço/identidade seja **certificado por uma autoridade** antes de ganhar estatuto homologado. No código deste repositório isto aparece apenas de forma **genérica**, não como uma autoridade emissora estruturada por país:

- `src/pages/CreateIdentity.tsx`: o nível de confiança é *"atribuído automaticamente após certificação por uma autoridade — não é opção aqui"*.
- `src/components/DashboardHeader.tsx` / `src/pages/Profile.tsx`: *"homologação junto às autoridades"* (texto de UI).
- `src/components/ResidentsTab.tsx`: estado `pending_authority` — *"Próximo passo: autoridade"*.

Ou seja, **a app modela um passo de homologação por autoridade**, mas **não** contém, neste repositório, uma tabela ou catálogo de *"autoridade emissora do certificado" detalhada por país* (que órgão emite, com que jurisdição, sob que base legal).

> `⚠️ a validar` — **A definição detalhada da autoridade emissora por país foi prototipada NOUTRA app, não neste repositório.** Não há aqui um mapeamento país → autoridade emissora. O que existe é (a) o eixo de **5 níveis de autorização administrativa** (Nacional→Local; ver `HIERARCHICAL_SYSTEM.md` e Manual 6), cujos administradores validam identidades na sua jurisdição, e (b) o estado genérico de homologação `pending_authority`. Qualquer afirmação sobre a autoridade concreta que emite o certificado em cada um dos 54 países deve ser confirmada com a fonte externa antes de publicar.

---

## 7. Changelog

| Versão | Data | Alterações |
|---|---|---|
| 1.0.0 | 2026-07-08 | Primeira edição. Modelo de 54 países / 834 unidades de nível 1 (ancorado em `africa-admin.json` + `africaAdmin.ts`); distribuição das 16 variantes de `nivel1_tipo`; línguas; mapeamento `CC-PROV-MUN-COM-BAI` aos segmentos do código; Angola em detalhe (21 províncias, comunas 2024 com parent=província); autoridade emissora marcada `⚠️ a validar` (prototipada noutra app). |
