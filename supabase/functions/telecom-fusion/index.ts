import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";

const TA_FACTOR = 78.12;
const REF_RSRP = -60;
const PATH_LOSS_N = 3.5;

interface Cell { 
  cellId: string; mcc: string; mnc: string; 
  rsrp?: number; rsrq?: number; rssi?: number; ta?: number; 
  lat?: number; lon?: number; 
}

interface Req { 
  primaryCell: Cell; 
  neighborCells?: Cell[]; 
  gpsLocation?: { latitude: number; longitude: number; accuracy: number }; 
  countryCode: string; 
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const distFromRSRP = (rsrp: number) => clamp(Math.pow(10, (REF_RSRP - rsrp) / (10 * PATH_LOSS_N)), 10, 35000);

const distFromTA = (ta: number) => ta * TA_FACTOR;

const signalQuality = (c: Cell) => {
  const scores: number[] = [];
  if (c.rsrp !== undefined) scores.push((c.rsrp + 140) / 96);
  if (c.rsrq !== undefined) scores.push((c.rsrq + 20) / 17);
  if (c.rssi !== undefined) scores.push((c.rssi + 113) / 62);
  return scores.length ? clamp(scores.reduce((a, b) => a + b) / scores.length, 0, 1) : 0.5;
};

const getDist = (c: Cell, def: number) => c.ta !== undefined ? distFromTA(c.ta) : c.rsrp !== undefined ? distFromRSRP(c.rsrp) : def;

const trilaterate = (towers: Array<Cell & { dist: number; w: number }>) => {
  if (!towers.length) throw new Error('No towers');
  let wLat = 0, wLon = 0, wSum = 0, wAcc = 0;
  for (const t of towers) {
    if (t.lat !== undefined && t.lon !== undefined) {
      wLat += t.lat * t.w; wLon += t.lon * t.w; wSum += t.w; wAcc += t.dist * t.w;
    }
  }
  if (!wSum) throw new Error('No weights');
  return { lat: wLat / wSum, lon: wLon / wSum, acc: wAcc / wSum / towers.length };
};

const fuse = (t: { lat: number; lon: number; acc: number }, g: { latitude: number; longitude: number; accuracy: number }) => {
  const tV = t.acc * t.acc, gV = g.accuracy * g.accuracy, inv = 1 / tV + 1 / gV;
  const lat = (t.lat / tV + g.latitude / gV) / inv;
  const lon = (t.lon / tV + g.longitude / gV) / inv;
  const acc = Math.sqrt(1 / inv);
  const dKm = Math.sqrt(Math.pow((t.lat - g.latitude) * 111, 2) + Math.pow((t.lon - g.longitude) * 111, 2));
  return { latitude: lat, longitude: lon, accuracy: acc, confidence: clamp(1 - dKm / ((t.acc + g.accuracy) / 1000) / 2, 0, 1) };
};

const calcScore = (n: number, q: number, hasTA: boolean, fc?: number) => 
  Math.min(25, Math.round(10 + Math.min(5, n * 2) + q * 5 + (hasTA ? 3 : 0) + (fc !== undefined ? fc * 2 : 0)));

const qualityLabel = (q: number) => q < 0.25 ? 'poor' : q < 0.5 ? 'fair' : q < 0.75 ? 'good' : 'excellent';

const process = (req: Req) => {
  const { primaryCell: pc, neighborCells = [], gpsLocation } = req;
  const towers: Array<Cell & { dist: number; w: number }> = [];
  
  if (pc.lat !== undefined && pc.lon !== undefined) {
    towers.push({ ...pc, dist: getDist(pc, 1000), w: signalQuality(pc) + 0.5 });
  }
  
  for (const c of neighborCells) {
    if (c.lat !== undefined && c.lon !== undefined) {
      towers.push({ ...c, dist: getDist(c, 2000), w: signalQuality(c) });
    }
  }
  
  if (!towers.length) throw new Error('No tower locations');
  
  const pos = trilaterate(towers);
  const avgQ = towers.reduce((s, t) => s + signalQuality(t), 0) / towers.length;
  const hasTA = towers.some(t => t.ta !== undefined);
  const method = towers.length === 1 ? 'single' : towers.length === 2 ? 'dual' : 'multi';
  
  const res: any = {
    estimatedLocation: { latitude: pos.lat, longitude: pos.lon, accuracy: pos.acc, confidence: clamp(avgQ + 0.2 * towers.length, 0, 1) },
    telecomScore: calcScore(towers.length, avgQ, hasTA),
    analysisDetails: { towersUsed: towers.length, trilaterationMethod: method, signalQuality: qualityLabel(avgQ), fusionApplied: false }
  };
  
  if (gpsLocation) {
    const f = fuse(pos, gpsLocation);
    res.fusedLocation = f;
    res.analysisDetails.fusionApplied = true;
    res.telecomScore = calcScore(towers.length, avgQ, hasTA, f.confidence);
  }
  
  return res;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const r: Req = await req.json();
    if (!r.primaryCell?.cellId || !r.primaryCell?.mcc || !r.primaryCell?.mnc || !r.countryCode) {
      return new Response(JSON.stringify({ error: 'Missing: primaryCell (cellId, mcc, mnc), countryCode' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    console.log(`TF: ${r.primaryCell.cellId} [${r.countryCode}]`);
    const result = process(r);
    console.log(`TF: score=${result.telecomScore}, towers=${result.analysisDetails.towersUsed}`);
    
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    console.error('TF error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
