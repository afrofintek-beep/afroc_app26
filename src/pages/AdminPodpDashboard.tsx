/**
 * Admin-only PoDP (Proof of Daily Presence) monitor.
 * Restricted server-side to user_authorization_levels.current_level >= 4.
 * NOT linked from the public navigation. Accessible at /admin/podp.
 */
import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Search, TrendingUp, Activity, Flame } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import SampleScatterMap from '@/components/podp/SampleScatterMap';

interface CycleKpi {
  verified_pct?: number;
  longest_streak?: number;
  current_streak?: number;
  avg_hours_per_day?: number;
  avg_hours_valid_day?: number;
  total_hours?: number;
  total_samples?: number;
  consistency?: number;
  base_score?: number;
  streak_bonus_pct?: number;
  final_score?: number;
}
interface Cycle {
  id: string;
  afroloc_record_id: string;
  user_id: string;
  cycle_start: string;
  cycle_end: string;
  valid_days: number;
  total_days: number;
  podp_score: number;
  kpi?: CycleKpi | null;
}
interface Daily {
  id: string;
  afroloc_record_id: string;
  day: string;
  valid_samples: number;
  hours_present: number;
  day_is_valid: boolean;
}

interface AddressAggregate {
  recordId: string;
  cycleCount: number;
  avgFinalScore: number;
  avgVerifiedPct: number;
  maxStreak: number;
  lastFinalScore: number;
}

interface SampleRow {
  id: string;
  captured_at: string;
  received_at: string;
  geo_lat: number;
  geo_lon: number;
  accuracy_m: number | null;
  distance_from_address_m: number | null;
  is_within_radius: boolean;
  rejection_reason: string | null;
  device_fingerprint: string | null;
}

interface DrillState {
  open: boolean;
  recordId: string | null;
  loading: boolean;
  error: string | null;
  cycles: Cycle[];
  daily: Daily[];
  samples: SampleRow[];
  rejectionBreakdown: Record<string, number>;
  address: { lat: number; lon: number } | null;
}

export default function AdminPodpDashboard() {
  const [recordId, setRecordId] = useState('');
  const [loading, setLoading] = useState(false);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [daily, setDaily] = useState<Daily[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<DrillState>({
    open: false, recordId: null, loading: false, error: null,
    cycles: [], daily: [], samples: [], rejectionBreakdown: {}, address: null,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (recordId.trim()) qs.set('recordId', recordId.trim());
      qs.set('limit', '200');
      const { data, error: invErr } = await supabase.functions.invoke(
        `podp-admin?${qs.toString()}`,
        { method: 'GET' },
      );
      if (invErr) throw invErr;
      setCycles(data?.cycles ?? []);
      setDaily(data?.daily ?? []);
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar PoDP');
    } finally {
      setLoading(false);
    }
  };

  const openDrill = async (rid: string) => {
    setDrill({
      open: true, recordId: rid, loading: true, error: null,
      cycles: [], daily: [], samples: [], rejectionBreakdown: {}, address: null,
    });
    try {
      const qs = new URLSearchParams({ recordId: rid, details: '1', limit: '300' });
      const { data, error: invErr } = await supabase.functions.invoke(
        `podp-admin?${qs.toString()}`,
        { method: 'GET' },
      );
      if (invErr) throw invErr;
      setDrill((d) => ({
        ...d,
        loading: false,
        cycles: data?.cycles ?? [],
        daily: data?.daily ?? [],
        samples: data?.samples ?? [],
        rejectionBreakdown: data?.rejectionBreakdown ?? {},
        address: data?.address ?? null,
      }));
    } catch (e: any) {
      setDrill((d) => ({ ...d, loading: false, error: e?.message || 'Erro ao carregar detalhes' }));
    }
  };

  const closeDrill = () => setDrill((d) => ({ ...d, open: false }));

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  // Per-cycle chart series (chronological)
  const cycleSeries = useMemo(() => {
    return [...cycles]
      .sort((a, b) => a.cycle_end.localeCompare(b.cycle_end))
      .map((c) => {
        const k = c.kpi ?? {};
        return {
          label: `${c.afroloc_record_id.slice(0, 6)}·${c.cycle_end.slice(5)}`,
          cycle_end: c.cycle_end,
          verified_pct: k.verified_pct ?? Math.round((c.valid_days / Math.max(c.total_days, 1)) * 1000) / 10,
          longest_streak: k.longest_streak ?? 0,
          current_streak: k.current_streak ?? 0,
          base_score: k.base_score ?? c.podp_score,
          final_score: k.final_score ?? c.podp_score,
        };
      });
  }, [cycles]);

  // Per-address aggregates
  const addressAggregates = useMemo<AddressAggregate[]>(() => {
    const map = new Map<string, Cycle[]>();
    for (const c of cycles) {
      const arr = map.get(c.afroloc_record_id) ?? [];
      arr.push(c);
      map.set(c.afroloc_record_id, arr);
    }
    const out: AddressAggregate[] = [];
    for (const [recordId, list] of map.entries()) {
      const sorted = [...list].sort((a, b) => a.cycle_end.localeCompare(b.cycle_end));
      const finals = sorted.map((c) => c.kpi?.final_score ?? c.podp_score);
      const verifs = sorted.map(
        (c) => c.kpi?.verified_pct ?? Math.round((c.valid_days / Math.max(c.total_days, 1)) * 1000) / 10,
      );
      const streaks = sorted.map((c) => c.kpi?.longest_streak ?? 0);
      const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
      out.push({
        recordId,
        cycleCount: sorted.length,
        avgFinalScore: Math.round(avg(finals) * 10) / 10,
        avgVerifiedPct: Math.round(avg(verifs) * 10) / 10,
        maxStreak: Math.max(0, ...streaks),
        lastFinalScore: finals[finals.length - 1] ?? 0,
      });
    }
    return out.sort((a, b) => b.avgFinalScore - a.avgFinalScore);
  }, [cycles]);

  const summary = useMemo(() => {
    if (!cycleSeries.length) return null;
    const finals = cycleSeries.map((c) => c.final_score);
    const verifs = cycleSeries.map((c) => c.verified_pct);
    const streaks = cycleSeries.map((c) => c.longest_streak);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    return {
      avgFinal: Math.round(avg(finals) * 10) / 10,
      avgVerified: Math.round(avg(verifs) * 10) / 10,
      maxStreak: Math.max(...streaks),
      totalCycles: cycleSeries.length,
    };
  }, [cycleSeries]);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">PoDP — Verificador silencioso</h1>
            <p className="text-sm text-muted-foreground">
              Métricas internas de presença diária. Apenas administradores nível 4+.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Consultar endereço</CardTitle>
            <CardDescription>Deixe vazio para ver os últimos ciclos globais.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              placeholder="ID do registo AFROLOC (opcional)"
              value={recordId}
              onChange={(e) => setRecordId(e.target.value)}
            />
            <Button onClick={load} disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              {loading ? 'A carregar…' : 'Consultar'}
            </Button>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {summary && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ciclos</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{summary.totalCycles}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Final médio</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{summary.avgFinal}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">% Verificada média</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{summary.avgVerified}%</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Streak máx.</CardTitle>
                <Flame className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{summary.maxStreak}d</div></CardContent>
            </Card>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Score final e % verificada por ciclo</CardTitle>
              <CardDescription>Evolução cronológica.</CardDescription>
            </CardHeader>
            <CardContent style={{ height: 280 }}>
              {cycleSeries.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cycleSeries} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="final_score" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Final" />
                    <Line type="monotone" dataKey="base_score" stroke="hsl(var(--muted-foreground))" strokeWidth={1} dot={false} name="Base" />
                    <Line type="monotone" dataKey="verified_pct" stroke="hsl(var(--chart-2, 142 71% 45%))" strokeWidth={1.5} dot={false} name="% Verif." />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Streaks por ciclo</CardTitle>
              <CardDescription>Mais longo vs. actual.</CardDescription>
            </CardHeader>
            <CardContent style={{ height: 280 }}>
              {cycleSeries.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cycleSeries} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="longest_streak" fill="hsl(var(--primary))" name="Longest" />
                    <Bar dataKey="current_streak" fill="hsl(var(--muted-foreground))" name="Current" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados.</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Final médio por endereço (Top {Math.min(addressAggregates.length, 20)})</CardTitle>
              <CardDescription>Agregado de todos os ciclos carregados.</CardDescription>
            </CardHeader>
            <CardContent style={{ height: 320 }}>
              {addressAggregates.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={addressAggregates.slice(0, 20).map((a) => ({
                      label: a.recordId.slice(0, 8),
                      avgFinalScore: a.avgFinalScore,
                      avgVerifiedPct: a.avgVerifiedPct,
                    }))}
                    margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="avgFinalScore" fill="hsl(var(--primary))" name="Final méd." />
                    <Bar dataKey="avgVerifiedPct" fill="hsl(var(--chart-2, 142 71% 45%))" name="% Verif. méd." />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Agregado por endereço ({addressAggregates.length})</CardTitle>
            <CardDescription>Média entre todos os ciclos retornados.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Registo</TableHead>
                  <TableHead># Ciclos</TableHead>
                  <TableHead>Final méd.</TableHead>
                  <TableHead>Último final</TableHead>
                  <TableHead>% Verif. méd.</TableHead>
                  <TableHead>Streak máx.</TableHead>
                  <TableHead className="text-right">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addressAggregates.map((a) => (
                  <TableRow
                    key={a.recordId}
                    className="cursor-pointer"
                    onClick={() => openDrill(a.recordId)}
                  >
                    <TableCell className="font-mono text-xs">{a.recordId.slice(0, 8)}…</TableCell>
                    <TableCell>{a.cycleCount}</TableCell>
                    <TableCell>
                      <Badge variant={a.avgFinalScore >= 70 ? 'default' : a.avgFinalScore >= 40 ? 'secondary' : 'destructive'}>
                        {a.avgFinalScore}
                      </Badge>
                    </TableCell>
                    <TableCell>{a.lastFinalScore}</TableCell>
                    <TableCell>{a.avgVerifiedPct}%</TableCell>
                    <TableCell>{a.maxStreak}d</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); openDrill(a.recordId); }}
                      >
                        Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {addressAggregates.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sem dados.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ciclos fechados ({cycles.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Registo</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Dias válidos</TableHead>
                  <TableHead>% Verificada</TableHead>
                  <TableHead>Streak (max/actual)</TableHead>
                  <TableHead>h/dia (méd)</TableHead>
                  <TableHead>Consist.</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>Final</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycles.map((c) => {
                  const k = c.kpi ?? {};
                  const final = k.final_score ?? c.podp_score;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.afroloc_record_id.slice(0, 8)}…</TableCell>
                      <TableCell>{c.cycle_start}</TableCell>
                      <TableCell>{c.cycle_end}</TableCell>
                      <TableCell>{c.valid_days}/{c.total_days}</TableCell>
                      <TableCell>{k.verified_pct != null ? `${k.verified_pct}%` : '—'}</TableCell>
                      <TableCell>{(k.longest_streak ?? '—')}/{(k.current_streak ?? '—')}</TableCell>
                      <TableCell>{k.avg_hours_per_day != null ? `${k.avg_hours_per_day}h` : '—'}</TableCell>
                      <TableCell>{k.consistency != null ? k.consistency.toFixed(2) : '—'}</TableCell>
                      <TableCell>{c.podp_score}</TableCell>
                      <TableCell>
                        <Badge variant={final >= 70 ? 'default' : final >= 40 ? 'secondary' : 'destructive'}>
                          {final}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {cycles.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Sem ciclos.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rollup diário ({daily.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Registo</TableHead>
                  <TableHead>Dia</TableHead>
                  <TableHead>Amostras válidas</TableHead>
                  <TableHead>Horas</TableHead>
                  <TableHead>Válido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daily.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.afroloc_record_id.slice(0, 8)}…</TableCell>
                    <TableCell>{d.day}</TableCell>
                    <TableCell>{d.valid_samples}</TableCell>
                    <TableCell>{Number(d.hours_present).toFixed(2)}h</TableCell>
                    <TableCell>
                      <Badge variant={d.day_is_valid ? 'default' : 'secondary'}>
                        {d.day_is_valid ? 'Sim' : 'Não'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {daily.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem dados.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={drill.open} onOpenChange={(o) => !o && closeDrill()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">
              Endereço {drill.recordId?.slice(0, 8)}… — Drill-down
            </DialogTitle>
            <DialogDescription>
              Ciclos, amostras e razões de reprovação registadas para este endereço.
            </DialogDescription>
          </DialogHeader>

          {drill.loading && <p className="text-sm text-muted-foreground">A carregar detalhes…</p>}
          {drill.error && <p className="text-sm text-destructive">{drill.error}</p>}

          {!drill.loading && !drill.error && (
            <div className="space-y-6">
              <section>
                <h3 className="mb-2 text-sm font-semibold">
                  Dispersão GPS{drill.address ? '' : ' (endereço sem coordenadas)'}
                </h3>
                <SampleScatterMap
                  address={drill.address}
                  samples={drill.samples.map((s) => ({
                    id: s.id,
                    geo_lat: Number(s.geo_lat),
                    geo_lon: Number(s.geo_lon),
                    is_within_radius: !!s.is_within_radius,
                    distance_from_address_m: s.distance_from_address_m,
                    captured_at: s.captured_at,
                    rejection_reason: s.rejection_reason,
                  }))}
                  height={360}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Círculo verde = tolerância urbana (75 m); círculo amarelo tracejado = tolerância rural (250 m).
                </p>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Razões de reprovação ({Object.values(drill.rejectionBreakdown).reduce((a, b) => a + b, 0)})</h3>
                {Object.keys(drill.rejectionBreakdown).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem reprovações registadas.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(drill.rejectionBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([reason, count]) => (
                        <Badge key={reason} variant="destructive" className="font-mono text-xs">
                          {reason}: {count}
                        </Badge>
                      ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Ciclos ({drill.cycles.length})</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Início</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead>Dias</TableHead>
                      <TableHead>% Verif.</TableHead>
                      <TableHead>Streak</TableHead>
                      <TableHead>Final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drill.cycles.map((c) => {
                      const k = c.kpi ?? {};
                      const final = k.final_score ?? c.podp_score;
                      return (
                        <TableRow key={c.id}>
                          <TableCell>{c.cycle_start}</TableCell>
                          <TableCell>{c.cycle_end}</TableCell>
                          <TableCell>{c.valid_days}/{c.total_days}</TableCell>
                          <TableCell>{k.verified_pct != null ? `${k.verified_pct}%` : '—'}</TableCell>
                          <TableCell>{k.longest_streak ?? '—'}/{k.current_streak ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant={final >= 70 ? 'default' : final >= 40 ? 'secondary' : 'destructive'}>
                              {final}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {drill.cycles.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem ciclos.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Amostras recentes ({drill.samples.length})</h3>
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Capturada em</TableHead>
                        <TableHead>Lat / Lon</TableHead>
                        <TableHead>Acc.</TableHead>
                        <TableHead>Dist.</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Reprovação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drill.samples.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-xs">{new Date(s.captured_at).toLocaleString()}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {s.geo_lat.toFixed(5)}, {s.geo_lon.toFixed(5)}
                          </TableCell>
                          <TableCell>{s.accuracy_m != null ? `${Number(s.accuracy_m).toFixed(0)}m` : '—'}</TableCell>
                          <TableCell>{s.distance_from_address_m != null ? `${Number(s.distance_from_address_m).toFixed(0)}m` : '—'}</TableCell>
                          <TableCell>
                            <Badge variant={s.is_within_radius ? 'default' : 'destructive'}>
                              {s.is_within_radius ? 'OK' : 'Fora'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{s.rejection_reason ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                      {drill.samples.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem amostras.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
