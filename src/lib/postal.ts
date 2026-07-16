// ─────────────────────────────────────────────────────────────────────────────
//  CÓDIGO POSTAL (CEP) — geográfico, determinístico. Parte A do sistema postal.
//
//  Angola NÃO tem código postal nacional oficial (a ENCTA anunciou um CEP mas
//  nunca o implementou; o mecanismo real é a Caixa Postal/Apartado numerada por
//  estação). Aqui deriva-se, POR ANALOGIA e de forma determinística, um código
//  postal a partir da divisão administrativa + do código AFROLOC.
//
//  Plano de numeração:
//    PP   = província (01–21, ORDEM OFICIAL da Lei n.º 14/24, Art. 2.º)
//    MM   = município (01–NN dentro da província, ordem alfabética)
//    ZZ   = zona (do segmento de grelha do código, ex. G10 → 10)
//    Estação postal = PPMM (província+município)
//
//  A atribuição de Caixa Postal/Apartado (número sequencial por estação) é a
//  Parte B — precisa de tabela + RPC atómica na BD (não localStorage), para não
//  colidir entre utilizadores. Ver memory/afroloc... (postal).
// ─────────────────────────────────────────────────────────────────────────────
import divisions from "../data/divisions.json";

interface Div { code: string; name: string; parent?: string }

const collator = new Intl.Collator("pt", { sensitivity: "base" });
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

// Ordem oficial das 21 províncias (Lei n.º 14/24, Artigo 2.º).
const INE_ORDER: Record<string, number> = {
  cabinda: 1, zaire: 2, uige: 3, bengo: 4, luanda: 5, icoloebengo: 6,
  cuanzanorte: 7, cuanzasul: 8, malanje: 9, lundanorte: 10, lundasul: 11,
  moxico: 12, moxicoleste: 13, bie: 14, huambo: 15, benguela: 16,
  namibe: 17, huila: 18, cunene: 19, cubango: 20, cuando: 21,
};

const PROV_NUM: Record<string, string> = {};
(divisions.provinces as Div[]).forEach((p) => {
  const n = INE_ORDER[norm(p.name)] ?? 0;
  PROV_NUM[p.code] = String(n).padStart(2, "0");
});

const MUN_NUM: Record<string, string> = {};
const byProv: Record<string, Div[]> = {};
(divisions.municipios as Div[]).forEach((m) => { (byProv[m.parent as string] ||= []).push(m); });
Object.values(byProv).forEach((list) => {
  list.sort((a, b) => collator.compare(a.name, b.name))
    .forEach((m, i) => { MUN_NUM[m.code] = String(i + 1).padStart(2, "0"); });
});

export interface PostalResult {
  cep: string;       // Código postal geográfico, ex.: "0505-10"
  station: string;   // Estação (província+município), ex.: "0505"
}

/** Código postal GEOGRÁFICO (do lugar) — derivado das divisões e do código AFROLOC. */
export function postalFrom(provinceCode: string, municipioCode: string, afrolocCode: string): PostalResult {
  const pp = PROV_NUM[provinceCode] || "00";
  const mm = MUN_NUM[municipioCode] || "00";
  const station = `${pp}${mm}`;
  const segs = (afrolocCode || "").split("-");
  const gridSeg = segs.find((s) => /^G\d/.test(s)) || "G00";
  const zz = gridSeg.replace(/^G/, "").slice(0, 2).padStart(2, "0");
  return { cep: `${station}-${zz}`, station };
}

/** Estação postal (PPMM) a partir da divisão — útil para agrupar por correios. */
export function stationFrom(provinceCode: string, municipioCode: string): string {
  return `${PROV_NUM[provinceCode] || "00"}${MUN_NUM[municipioCode] || "00"}`;
}
