# Especificação do Codec AFROLOC

> **CONFIDENCIAL — Propriedade intelectual da Afrofintek.** Documento interno.
> Não distribuir. Não colocar em `public/` nem em qualquer superfície acessível ao público.

| Campo | Valor |
|---|---|
| **Versão do documento** | 2.0.0 |
| **Data** | 2026-07-16 |
| **Aplica-se a** | AFROLOC app `1.0.0` (`src/lib/version.ts`) |
| **Fonte da verdade** | **`supabase/functions/_shared/afroloc_code.ts`** (implementação única, importada por `qg-engine` e `yamioo-gateway`) + `sq-engine` |
| **Estado** | Estável — algoritmo determinístico, cliente ↔ servidor idêntico |
| **Classificação** | Confidencial (IP) |

> **v2.0.0 — correção face à produção:** a v1.0.0 documentava um codec de
> coordenada **zig-zag** que existia no cliente antigo mas **nunca chegou à BD
> canónica** (a base nasceu depois da Fase A de proteção de IP, já com o
> `qg-engine`). O codec canónico real — em produção nos `afroloc_records`, no
> codec offline do cliente e nos ~243 mil códigos do Yamioo — é **base36 com
> prefixo `N` para negativos** (§4). Os testes vivem em
> `_shared/afroloc_code.test.ts` (executáveis com `npx tsx`).

---

## 1. Âmbito e audiência

Define o **algoritmo canónico** que converte coordenadas geográficas num **endereço digital AFROLOC** e vice-versa. Audiência: engenharia interna e auditoria técnica. Pressupõe que o mesmo algoritmo corre **offline no cliente e no servidor**, de modo que um código gerado sem rede reconcilia byte-a-byte ao sincronizar.

**Fora de âmbito:** ATS (score de confiança), PoDP, anti-spoofing e o fluxo de certificação — documentados nos manuais nº 5 (Segurança & Anti-fraude) e nº 4 (Administrador).

---

## 2. Modelo geral

O endereço resulta de **duas grelhas encaixadas**:

1. **QG — Quadrícula Geográfica (grelha nacional).** Projeta o ponto em Web Mercator e atribui-o a uma **célula** de tamanho fixo:
   - **Urbano:** 10 × 10 m (tag `G10`)
   - **Rural:** 25 × 25 m (tag `G25`)
2. **SQ — Subdivisão por densidade.** Dentro da célula QG, subdivide adaptativamente (2×2 → 5×5) consoante a densidade de certificações já existentes na célula, para desambiguar endereços próximos.

A precisão pública do endereço é a da **célula QG** (10 m urbano). A SQ e a sequência local afinam a unicidade sem alterar o ponto público.

---

## 3. Projeção — Web Mercator (EPSG:3857)

Constantes (`geo.ts`):

```
R       = 6378137.0        // raio WGS84 usado pelo Web Mercator
MAX_LAT = 85.05112878      // limite de latitude do Mercator
```

**WGS84 → Mercator** (`toMercator`):

```
clampLat = clamp(lat, -MAX_LAT, +MAX_LAT)
x = R · (lon · π/180)
y = R · ln( tan( π/4 + (clampLat · π/180)/2 ) )
```

**Mercator → WGS84** (`fromMercator`):

```
lon = (x / R) · (180/π)
lat = (2 · atan(exp(y / R)) − π/2) · (180/π)
```

> Nota de portabilidade: usar sempre a **mesma ordem de operações** (multiplicar antes de dividir por 10, ver §5) e `Math.floor`/`floor()` idênticos, para JS e SQL/plpgsql coincidirem ao bit em pontos fora da fronteira de célula.

---

## 4. Codec de coordenada — base36 com prefixo `N`

Os índices de célula (`ix`, `iy`) podem ser **negativos** (hemisférios sul/oeste). O sinal é representado pelo **prefixo `N`** no token base36 (maiúsculo).

**Encode** (`toBase36`):

```
token = (n < 0 ? "N" : "") + base36(|trunc(n)|).toUpperCase()
// toBase36(0) === "0"
```

**Decode** (`fromBase36`):

```
n = token.startsWith("N") ? −parseInt(token.slice(1), 36)
                          : parseInt(token, 36)
// "-" inicial também é aceite como sinal
```

Propriedade: `fromBase36(toBase36(n)) === n` para todo o inteiro `n`.

> **Histórico (zig-zag):** o cliente antigo (`sdk.ts`, removido na Fase A)
> usava um mapeamento zig-zag (`u = n≥0 ? 2n : −2n−1`) documentado na v1.0.0
> desta spec. Códigos zig-zag **não são descodificáveis** pelo motor atual e
> não existem na BD canónica; aparecem apenas em artefactos antigos (demo,
> PDFs de design). Um código zig-zag com prefixos X/Y é sintaticamente
> indistinguível de um N-prefix prefixado — por definição, a interpretação
> canónica é sempre N-prefix.

---

## 5. Índices de célula

```
gridSize = (zona === 'urban') ? 10 : 25
{ x, y } = toMercator(lat, lon)
ix = floor(x / gridSize)
iy = floor(y / gridSize)
```

O par de tokens da coordenada (forma **canónica, sem prefixos**):

```
XY = toBase36(ix) + "-" + toBase36(iy)
```

> **Prefixos `X`/`Y` (tolerados na entrada):** o codec offline do cliente e
> integrações antigas produzem `...-X<ix>-Y<iy>`. A normalização
> (`detectAndConvertLegacy`) remove os prefixos quando **ambos** os últimos
> segmentos os têm; a forma canónica é sempre sem prefixo. Sem esta remoção,
> `X`/`Y` seriam lidos como dígitos base36 (X=33, Y=34) e a célula
> descodificada seria outra — bug corrigido na v2.0.0.

---

## 6. Formatos do código

### 6.1 Standard (compacto / legado)

```
CC-ZU-G10-xxxx-yyyy        (urbano)
CC-ZR-G25-xxxx-yyyy        (rural)
```

- `CC` — ISO-3166-1 alpha-2 (ver §8).
- `ZU`/`ZR` — Zona Urbana / Zona Rural (`URBAN`/`RURAL` por extenso são convertidos).
- `xxxx`/`yyyy` — tokens §4 (prefixos `X`/`Y` tolerados e removidos).

### 6.2 Nomenclatura (com divisões administrativas)

```
CC-PROV-MUN-COM-BAI-G10-xxxx-yyyy[-NNNN]     (oficial, 7 partes + seq.)
CC-PROV-MUN-COM-G10-xxxx-yyyy                (sem bairro)
CC-PROV-MUN-G10-xxxx-yyyy                    (parcial, 6 partes)
CC-MUN-G10-xxxx-yyyy                         (mínimo, 5 partes)
```

A validação é feita por **contagem de partes + regras por segmento** em
`_shared/afroloc_code.ts` (`validateAfrolocCode`) — **não** por uma regex
única. Segmentos administrativos: `[A-Z0-9]{2,4}` (alfanuméricos — códigos
com dígitos são válidos); grelha: `G10` ou `G25`; coordenadas: `N?[0-9A-Z]+`.

> A v1 documentava regexes com segmentos só-letras `[A-Z]{2,3}` e o gateway
> tinha regexes próprias que exigiam prefixos `X`/`Y` e rejeitavam as formas
> de 5/6 partes — era por isso que um código devolvido pelo `lookup` era
> rejeitado pelo `share`. Na v2 há **um único validador** partilhado.

| Segmento | Significado | Origem |
|---|---|---|
| `CC` | País | ISO alpha-2 |
| `PROV` | Província / nível 1 | código do país ou slug de 3 letras |
| `MUN` | Município / nível 2 | slug de 3 letras |
| `COM` | Comuna / nível 3 | slug de 3 letras |
| `BAI` | **Bairro** | `neighborhoodCode` (formal) **ou** `"GEN"` (formal sem bairro) **ou** `"DIG"` (registo digital) |
| `G10`/`G25` | Grelha | urbano/rural |
| `X`,`Y` | Coordenada de célula | §4–§5 |
| `-NNNN` | Sequência local (opcional) | contador por sub-célula SQ |

> **Regra do `BAI`** (`_shared/afroloc_code.ts` `encodeAfroloc`): o formato mais completo possível é construído com os níveis presentes (oficial → sem bairro → parcial → mínimo → standard). `BAI = registrationType === 'digital' ? 'DIG' : neighborhoodCode`. Códigos administrativos são normalizados para 3 caracteres maiúsculos (`slice(0,3)`).

**Importante:** os dois formatos codificam **exatamente o mesmo ponto** — `G10-X-Y` é idêntico; a nomenclatura apenas antepõe rótulos administrativos. Ambos decodificam para os mesmos `ix/iy`.

---

## 7. Encode / Decode / Validate

Todas as funções vivem em **`supabase/functions/_shared/afroloc_code.ts`**.

### 7.1 Encode — `encodeAfroloc(request)`

1. Zona: `cellType` explícito ou `resolveZone(lat, lon, cc, adminPath)` (keywords de cidades + proximidade a centros urbanos; fallback rural).
2. `gridSize`, `zoneTag`, `gridTag` por zona; `lat` limitado a `±MAX_LAT`.
3. `ix`, `iy` (§5).
4. Código no formato mais completo possível (§6.2 → §6.1) com tokens §4 **sem prefixos**.
5. Devolve `{ afroloc, afrolocLegacy, country, zone, grid_m, tile_ix, tile_iy, códigos admin, bbox, centroid, webMercator }` — `afrolocLegacy` é sempre a forma standard.

### 7.2 Decode — `decodeAfroloc(code)`

1. `validateAfrolocCode(code)` → normaliza (uppercase/trim, conversões legadas, remoção de prefixos X/Y) e identifica o formato (`official|partial|minimal|legacy`).
2. Extrai `CC`, códigos admin, grelha, tokens.
3. `ix = fromBase36(x)`, `iy = fromBase36(y)`, `gridSize = parseInt(grid)`.
4. Devolve o mesmo shape do encode (sem `webMercator`) + `wasConverted`/`originalFormat`.

### 7.4 Geometria da célula — `cellGeometry(ix, iy, gridSize)`

```
minX = ix · gridSize ; minY = iy · gridSize
centroid = fromMercator(minX + gridSize/2, minY + gridSize/2)
bbox = {
  min = fromMercator(minX, minY),
  max = fromMercator(minX + gridSize, minY + gridSize)
}
```

O **centróide** é o ponto público do endereço (centro da célula), não o GPS bruto.

### 7.5 Validate — `validateAfrolocCode(code)` / `normalizeAfrolocCode(code)`

Aceita todos os formatos §6 (+ conversões legadas: `URBAN/RURAL`, prefixo `QG`, XY combinado, negativos com hífen, prefixos X/Y, formato com pontos+`@coords`); devolve `{ valid, normalizedCode, format, wasConverted, originalFormat, extractedAdmin, error? }`. O adaptador `normalizeAfrolocCode` devolve a assinatura histórica do gateway `{ valid, normalized, error? }`.

### 7.6 Formas equivalentes — `codeForms(normalized)`

Devolve `[canónica, prefixada-X/Y]` para lookups em BD onde registos históricos possam ter sido gravados com prefixos.

---

## 8. Validação de país

Apenas os **54 códigos ISO alpha-2 africanos** (`AFRICAN_COUNTRIES`, derivado de `COUNTRIES` em `data/africaAdmin`). Qualquer outro `CC` é rejeitado em `encode`.

---

## 9. Motor SQ — subdivisão por densidade (`engines.ts`)

Dentro da célula QG, subdivide por **contagem de certificações** já presentes:

| Classe | Limiar (`DENSITY_THRESHOLDS`) | Subdivisão | Rótulos |
|---|---|---|---|
| `low` | ≤ 10 | 2×2 | `A B C D` |
| `medium` | ≤ 50 | 3×3 | `1…9` |
| `high` | ≤ 150 | 4×4 | `A1…D4` |
| `very_high` | > 150 | 5×5 | `A1…E5` |

A sub-célula (`sqCode`) resulta de `col/row` do ponto dentro dos limites da célula (linha 0 = topo/maxLat). A **sequência local** (`-NNNN`) é escopada ao par `fullCode#sqCode`.

---

## 10. Orquestrador de criação (`createAddress.ts`)

Cadeia determinística (spec §1 do sistema):

```
validar entrada
  → integridade GPS/EXIF (anti-spoofing; flags bloqueantes param a criação)
  → QG Engine (célula + nomenclatura)
  → SQ Engine (subdivisão por densidade)
  → sequência local (por sub-célula)
  → ATS Engine (score de confiança)
```

O código visível final é `fullCode-NNNN` (nomenclatura + sequência). GPS/EXIF, testemunhas e validador **não** alteram o codec — alimentam o ATS.

---

## 11. Exemplo trabalhado (Talatona, Luanda)

Entrada: `lat = −8.93311`, `lon = 13.18261`, `cc = AO`, zona urbana.

```
ix = 146748 ; iy = −99849
standard      : AO-ZU-G10-358C-N251L
nomenclatura  : AO-LUA-TAL-TAL-GEN-G10-358C-N251L
centro célula : −8.933130, 13.182642   (célula ~10 m)
```

(Valores verificados por `_shared/afroloc_code.test.ts`. Na v1, a mesma
célula era rendida em zig-zag como `X6AGO-Y4A35` — os índices `ix`/`iy` e o
centróide são idênticos; só a codificação do token mudou.)

Decodificação inversa (código real de produção do Yamioo, Ingombota):

```
AO-LUA-LUA-ING-G10-35MZ-N240O
  → forma prefixada equivalente (aceite): AO-LUA-LUA-ING-G10-X35MZ-YN240O
  → decodifica para o centróide da célula em Luanda
```

---

## 12. Invariantes e compatibilidade

- **Determinismo:** para a mesma entrada, o código é sempre o mesmo (cliente = servidor).
- **Round-trip:** `decode(encode(p))` devolve o **centróide da célula** de `p` (não `p` exato — a informação sub-célula-QG é intencionalmente descartada no ponto público).
- **Coincidência JS ↔ SQL:** ao replicar o codec noutra linguagem (ex.: plpgsql na coluna gerada do Yamioo), manter ordem de operações e `floor` idênticos. Verificado byte-a-byte para pontos-teste.
- **Estabilidade do formato:** alterações a `G10`/tamanhos de célula, ordem de segmentos ou ao codec de coordenada são **breaking changes** (implicam nova versão MAJOR desta spec e migração de códigos existentes).

---

## 13. Changelog

| Versão | Data | Alteração |
|---|---|---|
| 2.0.0 | 2026-07-16 | **Correção do codec de coordenada: base36 com prefixo `N` (não zig-zag)** — a v1 descrevia o cliente antigo, não a produção. Fonte da verdade passa a ser `_shared/afroloc_code.ts` (implementação única importada por `qg-engine` e `yamioo-gateway`; elimina os 3 validadores divergentes). Forma canónica sem prefixos `X`/`Y` (prefixos tolerados e removidos na entrada — corrige decode errado de códigos offline). Formatos de 5/6 partes documentados. Testes em `_shared/afroloc_code.test.ts`. |
| 1.0.0 | 2026-07-08 | Versão inicial, extraída do código canónico (`geo/sdk/engines/createAddress`). |
