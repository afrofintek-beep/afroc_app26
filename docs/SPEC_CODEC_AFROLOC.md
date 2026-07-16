# Especificação do Codec AFROLOC

> **CONFIDENCIAL — Propriedade intelectual da Afrofintek.** Documento interno.
> Não distribuir. Não colocar em `public/` nem em qualquer superfície acessível ao público.

| Campo | Valor |
|---|---|
| **Versão do documento** | 1.0.0 |
| **Data** | 2026-07-08 |
| **Aplica-se a** | AFROLOC app `1.0.0` (`src/lib/version.ts`) |
| **Fonte da verdade** | `src/lib/afroloc/{geo,sdk,engines,createAddress}.ts` + edge functions `qg-engine`, `sq-engine` |
| **Estado** | Estável — algoritmo determinístico, cliente ↔ servidor idêntico |
| **Classificação** | Confidencial (IP) |

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

## 4. Codec de coordenada — base36 zig-zag

Os índices de célula (`ix`, `iy`) podem ser **negativos** (hemisférios sul/oeste). Aplica-se um mapeamento **zig-zag** (inteiro com sinal → inteiro sem sinal) antes do base36, para os tokens ficarem sem sinal e reversíveis.

**Encode** (`encodeCoord`):

```
u = (n ≥ 0) ? n·2 : (−n·2 − 1)
token = base36(u).toUpperCase()
```

**Decode** (`decodeCoord`):

```
u = parseInt(token, 36)
n = (u % 2 === 0) ? u/2 : −(u+1)/2
```

Propriedade: `decodeCoord(encodeCoord(n)) === n` para todo o inteiro `n`.

---

## 5. Índices de célula

```
gridSize = (zona === 'urban') ? 10 : 25
{ x, y } = toMercator(lat, lon)
ix = floor(x / gridSize)
iy = floor(y / gridSize)
```

O par de tokens da coordenada:

```
XY = "X" + encodeCoord(ix) + "-Y" + encodeCoord(iy)
```

---

## 6. Formatos do código

### 6.1 Standard (compacto / legado)

```
CC-ZU-G10-Xxxxx-Yyyyy        (urbano)
CC-ZR-G25-Xxxxx-Yyyyy        (rural)
```

Regex (`sdk.ts` `STANDARD_PATTERN`):

```
/^([A-Z]{2})-(ZU|ZR)-(G10|G25)-X([0-9A-Z]+)-Y([0-9A-Z]+)$/
```

- `CC` — ISO-3166-1 alpha-2 (ver §8).
- `ZU`/`ZR` — Zona Urbana / Zona Rural.

### 6.2 Nomenclatura (com divisões administrativas)

```
CC-PROV-MUN-COM-BAI-G10-Xxxxx-Yyyyy[-NNNN]
```

Regex (`NOMENCLATURE_PATTERN`):

```
/^([A-Z]{2})-([A-Z]{2,3})-([A-Z]{2,3})-([A-Z]{2,3})-([A-Z]{2,3})-(G10|G25)-X([0-9A-Z]+)-Y([0-9A-Z]+)(?:-\d{4})?$/
```

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

> **Regra do `BAI`** (`engines.ts` `qgEncode`): a nomenclatura só é construída quando existem `PROV` **e** `MUN` **e** `COM`. `BAI = registrationType === 'formal' ? (neighborhoodCode || 'GEN') : 'DIG'`. Sem os três níveis administrativos, cai-se no formato **standard** (§6.1).

**Importante:** os dois formatos codificam **exatamente o mesmo ponto** — `G10-X-Y` é idêntico; a nomenclatura apenas antepõe rótulos administrativos. Ambos decodificam para os mesmos `ix/iy`.

---

## 7. Encode / Decode / Validate

### 7.1 Encode (standard) — `sdk.ts` `encode(lat, lon, cc, zone)`

1. Validar `cc` (§8), `lat ∈ [−MAX_LAT, +MAX_LAT]`, `lon ∈ [−180, 180]`.
2. `gridSize`, `zoneTag`, `gridTag` por zona.
3. `ix`, `iy` (§5).
4. `code = CC-ZoneTag-GridTag-XencodeCoord(ix)-YencodeCoord(iy)`.
5. Devolve `{ code, zone, gridSize, ix, iy }`.

### 7.2 Nomenclatura — `engines.ts` `qgEncode(...)`

Envolve `encode()` e, havendo `admin = {provinceCode, municipalityCode, communeCode, neighborhoodCode}`, produz o formato §6.2 (com a regra do `BAI`). Devolve também `bbox` e `centroid` (§7.4).

### 7.3 Decode — `sdk.ts` `decode(code)`

1. `validate(code)` → normaliza (uppercase/trim) e identifica o formato.
2. Extrai `CC`, grelha, `X`, `Y`.
3. `ix = decodeCoord(X)`, `iy = decodeCoord(Y)`, `gridSize = parseInt(grid)`.
4. Devolve `{ countryCode, zone, gridSize, ix, iy, centroid, bbox }`.

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

### 7.5 Validate — `sdk.ts` `validate(code)`

Aceita **standard** e **nomenclatura**; devolve `{ valid, normalizedCode, format: 'standard'|'nomenclature', error? }`.

### 7.6 Distância entre códigos — `distance(a, b)`

Haversine (R = 6 371 000 m) entre os centróides de dois códigos.

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
standard      : AO-ZU-G10-X6AGO-Y4A35
nomenclatura  : AO-LUA-TAL-TAL-GEN-G10-X6AGO-Y4A35
centro célula : −8.933130, 13.182642   (célula ~10 m)
```

Decodificação inversa (código real gerado pelo Yamioo, mesmo bairro):

```
AO-LUA-TAL-TAL-GEN-G10-X6AGM-Y4A33
  → ix = 146747 ; iy = −99848
  → −8.933041, 13.182552
```

Os dois pontos distam **~14 m** — 1 célula em cada eixo — o que ilustra a resolução de 10 m: um passo de ~14 m salta para a célula vizinha, refletido no último caractere de `X` e `Y`.

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
| 1.0.0 | 2026-07-08 | Versão inicial, extraída do código canónico (`geo/sdk/engines/createAddress`). |
