// ─────────────────────────────────────────────────────────────────────────────
//  CÓDIGO POSTAL (CEP) — geográfico, determinístico, com DÍGITOS COM SIGNIFICADO.
//
//  Angola NÃO tem código postal nacional oficial (a ENCTA anunciou um CEP mas
//  nunca o implementou; o mecanismo real é a Caixa Postal/Apartado numerada por
//  estação). Aqui deriva-se, POR ANALOGIA e de forma determinística, um código
//  postal a partir da divisão administrativa (Lei n.º 14/24) + do código AFROLOC.
//
//  Plano de numeração — à semelhança do Brasil/Alemanha, o dígito mais
//  significativo é a MACRO-REGIÃO e cada dígito tem leitura própria:
//
//    R    = macro-região geográfica  (1 Norte · 2 Centro · 3 Sul · 4 Leste · 5 Oeste)
//    PP   = província  (01–21, ORDEM OFICIAL da Lei n.º 14/24, Art. 2.º)
//    MM   = município  (01–NN dentro da província, ordem alfabética)
//    CC   = comuna     (01–NN dentro do município, ordem alfabética;
//                       00 = município sem comunas próprias listadas / nível-sede)
//    ZZ   = zona       (do segmento de grelha do código AFROLOC, ex. G10 → 10)
//
//    Estação postal = R PP MM CC  (7 dígitos, todos com significado)
//    Código Postal  = <estação>-ZZ            ex.: 5051500-07
//    Caixa Postal   = <estação>-<sequencial>  ex.: 5051500-00042  (Parte B, RPC atómica)
//
//  IMPORTANTE: as chaves (códigos de província/município) são as REAIS da BD
//  `administrative_divisions` — as MESMAS que os registos carregam (level1_code,
//  level2_code). Antes usava-se src/data/divisions.json, cujo esquema de códigos
//  DIVERGIA da BD (16/21 províncias diferentes) e fazia o PP/MM cair para "00".
//
//  Fonte: src/data/postal-divisions.json (códigos da BD ljcx + mapeamento
//  comuna→município do Quadro DPA 2024.08, validado 21 / 326 / 378).
// ─────────────────────────────────────────────────────────────────────────────
import postalDiv from "../data/postal-divisions.json";

interface Div { code: string; name: string; parent?: string }

const collator = new Intl.Collator("pt", { sensitivity: "base" });
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Ordem oficial das 21 províncias (Lei n.º 14/24, Artigo 2.º).
const INE_ORDER: Record<string, number> = {
  cabinda: 1, zaire: 2, uige: 3, bengo: 4, luanda: 5, icoloebengo: 6,
  cuanzanorte: 7, cuanzasul: 8, malanje: 9, lundanorte: 10, lundasul: 11,
  moxico: 12, moxicoleste: 13, bie: 14, huambo: 15, benguela: 16,
  namibe: 17, huila: 18, cunene: 19, cubango: 20, cuando: 21,
};

const PROV_NUM: Record<string, string> = {};
(postalDiv.provinces as Div[]).forEach((p) => {
  const n = INE_ORDER[norm(p.name)] ?? 0;
  PROV_NUM[p.code] = String(n).padStart(2, "0");
});

const MUN_NUM: Record<string, string> = {};
const byProv: Record<string, Div[]> = {};
(postalDiv.municipios as Div[]).forEach((m) => { (byProv[m.parent as string] ||= []).push(m); });
Object.values(byProv).forEach((list) => {
  list.sort((a, b) => collator.compare(a.name, b.name))
    .forEach((m, i) => { MUN_NUM[m.code] = String(i + 1).padStart(2, "0"); });
});

// Macro-região por província (1..5) e comunas por município — do postal-divisions.json.
const PROV_REGION = postalDiv.provinceRegion as Record<string, number>;
const REGIONS = postalDiv.regions as Record<string, { name: string; provinceCodes: string[] }>;

// Índice de comuna dentro do município: COMUNA_IDX[municipioCode][slug(comuna)] = CC.
const COMUNA_IDX: Record<string, Record<string, number>> = {};
Object.entries(postalDiv.comunas as Record<string, string[]>).forEach(([mc, list]) => {
  const map: Record<string, number> = {};
  list.forEach((name, i) => { map[norm(name)] = i + 1; });
  COMUNA_IDX[mc] = map;
});

// Aliases de grafia (nome da comuna tal como vem do registo → grafia canónica).
// Não é preciso hoje (os nomes batem 378/378 com a BD); ponto de extensão futuro.
const COMUNA_ALIAS: Record<string, string> = {};

/** CC (comuna, 2 díg) dentro do município. "00" se não houver comuna própria/correspondência. */
function ccFor(municipioCode: string, comunaName?: string | null): string {
  if (!comunaName) return "00";
  const map = COMUNA_IDX[municipioCode];
  if (!map) return "00";
  let s = norm(comunaName);
  s = COMUNA_ALIAS[s] ?? s;
  const cc = map[s];
  return cc ? String(cc).padStart(2, "0") : "00";
}

export interface RegionInfo { code: number; name: string }
export interface PostalResult {
  cep: string;        // Código postal geográfico, ex.: "5051500-07"
  station: string;    // Estação R·PP·MM·CC (7 díg.), ex.: "5051500"
  region: RegionInfo; // Macro-região (dígito R)
  parts: { r: string; pp: string; mm: string; cc: string; zz: string };
}

/** Macro-região de uma província (dígito R e nome). */
export function regionOf(provinceCode: string): RegionInfo {
  const r = PROV_REGION[provinceCode] ?? 0;
  return { code: r, name: r ? REGIONS[String(r)].name : "—" };
}

/**
 * Código postal GEOGRÁFICO (do lugar) — derivado das divisões (Lei 14/24) e do
 * código AFROLOC. Cada dígito tem significado; R = macro-região.
 * @param comunaName  nome da comuna (level3_name) — opcional; sem ele, CC = "00".
 */
export function postalFrom(
  provinceCode: string,
  municipioCode: string,
  afrolocCode: string,
  comunaName?: string | null,
): PostalResult {
  const r = String(PROV_REGION[provinceCode] ?? 0);
  const pp = PROV_NUM[provinceCode] || "00";
  const mm = MUN_NUM[municipioCode] || "00";
  const cc = ccFor(municipioCode, comunaName);
  const station = `${r}${pp}${mm}${cc}`;
  const segs = (afrolocCode || "").split("-");
  const gridSeg = segs.find((s) => /^G\d/.test(s)) || "G00";
  const zz = gridSeg.replace(/^G/, "").slice(0, 2).padStart(2, "0");
  return { cep: `${station}-${zz}`, station, region: regionOf(provinceCode), parts: { r, pp, mm, cc, zz } };
}

/** Estação postal (R·PP·MM·CC, 7 díg.) — agrupa Caixas Postais/Apartados. */
export function stationFrom(provinceCode: string, municipioCode: string, comunaName?: string | null): string {
  const r = String(PROV_REGION[provinceCode] ?? 0);
  return `${r}${PROV_NUM[provinceCode] || "00"}${MUN_NUM[municipioCode] || "00"}${ccFor(municipioCode, comunaName)}`;
}

/** Decomposição legível do código, para explicar "porque este código" na UI. */
export function explainPostal(result: PostalResult): Array<{ label: string; digits: string; value: string }> {
  const { parts, region } = result;
  return [
    { label: "Região", digits: parts.r, value: region.name },
    { label: "Província", digits: parts.pp, value: `nº ${parts.pp} (ordem Lei 14/24)` },
    { label: "Município", digits: parts.mm, value: `nº ${parts.mm} na província` },
    { label: "Comuna", digits: parts.cc, value: parts.cc === "00" ? "sede do município" : `nº ${parts.cc} no município` },
    { label: "Zona", digits: parts.zz, value: `grelha ${parts.zz}` },
  ];
}
