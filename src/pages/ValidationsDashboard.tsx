import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MessageSquare, CheckCircle, XCircle, Clock, TrendingUp, Search, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ValidationMetrics {
  total: number;
  pending: number;
  confirmed: number;
  rejected: number;
  avgResponseTime: number;
  responseRate: number;
}

interface WitnessValidation {
  id: string;
  afroloc_record_id: string;
  witness_afro_id: string;
  status: string;
  created_at: string;
  validated_at: string | null;
  otp_sent_at: string | null;
  afroloc_records: {
    code: string;
    geo_lat: number | null;
    geo_lon: number | null;
  };
}

const ValidationsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ValidationMetrics>({
    total: 0,
    pending: 0,
    confirmed: 0,
    rejected: 0,
    avgResponseTime: 0,
    responseRate: 0,
  });
  const [recentValidations, setRecentValidations] = useState<WitnessValidation[]>([]);
  const [filteredValidations, setFilteredValidations] = useState<WitnessValidation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    loadMetrics();
    loadRecentValidations();

    // Set up real-time subscription
    const channel = supabase
      .channel('validations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'afroloc_witnesses'
        },
        (payload) => {
          console.log('Real-time update:', payload);
          loadMetrics();
          loadRecentValidations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, statusFilter, recentValidations]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/landing");
      return;
    }
    setLoading(false);
  };

  const loadMetrics = async () => {
    try {
      const { data: witnesses, error } = await supabase
        .from('afroloc_witnesses')
        .select('status, created_at, validated_at, otp_sent_at');

      if (error) throw error;

      const total = witnesses?.length || 0;
      const pending = witnesses?.filter(w => w.status === 'pending').length || 0;
      const confirmed = witnesses?.filter(w => w.status === 'confirmed').length || 0;
      const rejected = witnesses?.filter(w => w.status === 'rejected').length || 0;

      // Calculate average response time (in minutes)
      const responseTimes = witnesses
        ?.filter(w => w.validated_at && w.otp_sent_at)
        .map(w => {
          const sent = new Date(w.otp_sent_at!).getTime();
          const validated = new Date(w.validated_at!).getTime();
          return (validated - sent) / (1000 * 60); // Convert to minutes
        }) || [];

      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

      const responseRate = total > 0 ? ((confirmed + rejected) / total) * 100 : 0;

      setMetrics({
        total,
        pending,
        confirmed,
        rejected,
        avgResponseTime: Math.round(avgResponseTime),
        responseRate: Math.round(responseRate),
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  };

  const loadRecentValidations = async () => {
    try {
      const { data, error } = await supabase
        .from('afroloc_witnesses')
        .select(`
          id,
          afroloc_record_id,
          witness_afro_id,
          status,
          created_at,
          validated_at,
          otp_sent_at,
          afroloc_records (
            code,
            geo_lat,
            geo_lon
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100); // Load more for filtering

      if (error) throw error;
      setRecentValidations(data || []);
    } catch (error) {
      console.error('Error loading recent validations:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...recentValidations];

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(v => v.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(v => 
        v.witness_afro_id.toLowerCase().includes(search) ||
        v.afroloc_records?.code?.toLowerCase().includes(search)
      );
    }

    setFilteredValidations(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Pagination
  const totalPages = Math.ceil(filteredValidations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentValidations = filteredValidations.slice(startIndex, endIndex);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-500 hover:bg-green-600">Confirmada</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500 hover:bg-red-600">Rejeitada</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        
        <main className="flex-1 p-6">
          <div className="mb-8 flex items-start gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="flex-shrink-0 mt-1"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Dashboard de Validações SMS</h1>
              <p className="text-muted-foreground">Monitoramento em tempo real das validações por SMS</p>
            </div>
          </div>

          {/* Metrics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
            <StatCard
              title="Total"
              value={metrics.total.toString()}
              change="Validações totais"
              icon={MessageSquare}
            />
            <StatCard
              title="Pendentes"
              value={metrics.pending.toString()}
              change="Aguardando resposta"
              icon={Clock}
            />
            <StatCard
              title="Confirmadas"
              value={metrics.confirmed.toString()}
              change={`${((metrics.confirmed / metrics.total) * 100 || 0).toFixed(1)}% do total`}
              icon={CheckCircle}
              trend="up"
            />
            <StatCard
              title="Rejeitadas"
              value={metrics.rejected.toString()}
              change={`${((metrics.rejected / metrics.total) * 100 || 0).toFixed(1)}% do total`}
              icon={XCircle}
              trend="down"
            />
            <StatCard
              title="Tempo Médio"
              value={`${metrics.avgResponseTime}min`}
              change="Tempo de resposta"
              icon={TrendingUp}
            />
            <StatCard
              title="Taxa de Resposta"
              value={`${metrics.responseRate}%`}
              change="Respondidas"
              icon={TrendingUp}
              trend="up"
            />
          </div>

          {/* Recent Validations */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Validações Recentes</CardTitle>
                  <CardDescription>Atualização em tempo real</CardDescription>
                </div>
                
                {/* Filters */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      className="pl-8 w-[200px]"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                      <SelectItem value="confirmed">Confirmadas</SelectItem>
                      <SelectItem value="rejected">Rejeitadas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {currentValidations.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma validação encontrada
                  </p>
                ) : (
                  currentValidations.map((validation) => {
                    const geoCoords = validation.afroloc_records?.geo_lat && validation.afroloc_records?.geo_lon
                      ? `(${validation.afroloc_records.geo_lat}, ${validation.afroloc_records.geo_lon})`
                      : "";
                    const address = geoCoords 
                      ? `${validation.afroloc_records?.code} ${geoCoords}`
                      : validation.afroloc_records?.code;

                    return (
                      <div key={validation.id} className="flex items-center gap-4 rounded-lg border border-border p-4 hover:bg-accent/50 transition-colors">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          {validation.status === 'confirmed' && <CheckCircle className="h-5 w-5 text-green-500" />}
                          {validation.status === 'rejected' && <XCircle className="h-5 w-5 text-red-500" />}
                          {validation.status === 'pending' && <Clock className="h-5 w-5 text-yellow-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {address}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Testemunha: {validation.witness_afro_id}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {validation.otp_sent_at 
                              ? `Enviado ${formatDistanceToNow(new Date(validation.otp_sent_at), { addSuffix: true })}`
                              : 'SMS não enviado'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {getStatusBadge(validation.status)}
                          {validation.validated_at && (
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(validation.validated_at), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {startIndex + 1}-{Math.min(endIndex, filteredValidations.length)} de {filteredValidations.length}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = i + 1;
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-8"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      {totalPages > 5 && <span className="text-muted-foreground">...</span>}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </DashboardLayout>
  );
};

export default ValidationsDashboard;
