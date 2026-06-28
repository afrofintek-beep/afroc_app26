import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserRole } from "@/hooks/useUserRole";
import { useCountries } from "@/hooks/useCountries";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, UserPlus, Users, BarChart3, AlertCircle, CheckCircle2, Clock, Phone, TrendingUp, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const ValidatorManagement = () => {
  const { role, loading: roleLoading } = useUserRole();
  const { countries, isLoading: countriesLoading } = useCountries();
  const { toast } = useToast();
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [validatorUserId, setValidatorUserId] = useState<string>("");
  const [divisionId, setDivisionId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch administrative divisions
  const { data: divisions } = useQuery({
    queryKey: ["divisions", selectedCountry],
    queryFn: async () => {
      if (!selectedCountry) return [];
      const { data, error } = await supabase
        .from("administrative_divisions")
        .select("*")
        .eq("country_code", selectedCountry)
        .order("level", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCountry,
  });

  // Fetch validation numbers
  const { data: validationNumbers, refetch } = useQuery({
    queryKey: ["validation_numbers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("validation_phone_numbers")
        .select(`
          *,
          administrative_divisions (
            name,
            level,
            code
          ),
          profiles:validator_user_id (
            full_name,
            phone
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch user stats if validator
  const { data: validatorStats } = useQuery({
    queryKey: ["validator_stats"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("validation_phone_numbers")
        .select("*")
        .eq("validator_user_id", user.id)
        .single();
      
      if (error) return null;
      return data;
    },
    enabled: role === "validator",
  });

  // Fetch validation metrics for charts
  const { data: validationMetrics } = useQuery({
    queryKey: ["validation_metrics"],
    queryFn: async () => {
      // Get validations by region
      const { data: regionData, error: regionError } = await supabase
        .from("validation_phone_numbers")
        .select(`
          administrative_division_id,
          usage_count,
          administrative_divisions (
            name,
            country_code
          )
        `);
      
      if (regionError) throw regionError;

      // Get validation activity over time (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: witnessData, error: witnessError } = await supabase
        .from("afroloc_witnesses")
        .select("validated_at, status")
        .gte("validated_at", thirtyDaysAgo.toISOString());
      
      if (witnessError) throw witnessError;

      // Process data for charts
      const regionMap = new Map();
      regionData?.forEach(item => {
        const divisionName = (item.administrative_divisions as any)?.name || "Sem região";
        const current = regionMap.get(divisionName) || 0;
        regionMap.set(divisionName, current + (item.usage_count || 0));
      });

      const regionChartData = Array.from(regionMap.entries())
        .map(([name, count]) => ({ name, validations: count }))
        .sort((a, b) => b.validations - a.validations)
        .slice(0, 10);

      // Process timeline data
      const timelineMap = new Map();
      witnessData?.forEach(item => {
        if (item.validated_at) {
          const date = new Date(item.validated_at).toLocaleDateString("pt");
          const current = timelineMap.get(date) || 0;
          timelineMap.set(date, current + 1);
        }
      });

      const timelineData = Array.from(timelineMap.entries())
        .map(([date, count]) => ({ date, validations: count }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Status distribution
      const statusMap = new Map();
      witnessData?.forEach(item => {
        const status = item.status || "pending";
        const current = statusMap.get(status) || 0;
        statusMap.set(status, current + 1);
      });

      const statusData = Array.from(statusMap.entries())
        .map(([name, value]) => ({ name, value }));

      return {
        regionData: regionChartData,
        timelineData,
        statusData,
      };
    },
    enabled: role === "admin" || role === "moderator",
  });

  const handleCreateValidator = async () => {
    if (!phoneNumber || !selectedCountry || !divisionId) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("validation_phone_numbers")
        .insert({
          phone_number: phoneNumber,
          country_code: selectedCountry,
          administrative_division_id: divisionId,
          validator_user_id: validatorUserId || null,
          is_active: true,
          verification_status: "verified",
        });

      if (error) throw error;

      toast({
        title: "Validador criado",
        description: "Número de validação criado com sucesso",
      });

      // Reset form
      setPhoneNumber("");
      setValidatorUserId("");
      setDivisionId("");
      refetch();
    } catch (error: any) {
      toast({
        title: "Erro ao criar validador",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (roleLoading || countriesLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Admin View - Full management
  if (role === "admin" || role === "moderator") {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Gestão de Validadores</h1>
              <p className="text-sm text-muted-foreground">Sistema administrativo de validadores regionais</p>
            </div>
          </div>

          <Tabs defaultValue="create" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="create">
                <UserPlus className="h-4 w-4 mr-2" />
                Criar Validador
              </TabsTrigger>
              <TabsTrigger value="list">
                <Users className="h-4 w-4 mr-2" />
                Lista de Validadores
              </TabsTrigger>
              <TabsTrigger value="stats">
                <BarChart3 className="h-4 w-4 mr-2" />
                Estatísticas
              </TabsTrigger>
              <TabsTrigger value="analytics">
                <TrendingUp className="h-4 w-4 mr-2" />
                Métricas Avançadas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create">
              <Card>
                <CardHeader>
                  <CardTitle>Adicionar Novo Validador</CardTitle>
                  <CardDescription>
                    Cadastre um número de telefone para validação regional
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="country">País *</Label>
                      <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                        <SelectTrigger id="country">
                          <SelectValue placeholder="Selecione o país" />
                        </SelectTrigger>
                        <SelectContent>
                          {countries?.map((country) => (
                            <SelectItem key={country.country_code} value={country.country_code}>
                              {country.country_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Número de Telefone *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+244 XXX XXX XXX"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="division">Divisão Administrativa *</Label>
                      <Select value={divisionId} onValueChange={setDivisionId} disabled={!selectedCountry}>
                        <SelectTrigger id="division">
                          <SelectValue placeholder="Selecione a região" />
                        </SelectTrigger>
                        <SelectContent>
                          {divisions?.map((division) => (
                            <SelectItem key={division.id} value={division.id}>
                              {division.name} (Nível {division.level})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="userId">ID do Usuário (opcional)</Label>
                      <Input
                        id="userId"
                        placeholder="UUID do usuário validador"
                        value={validatorUserId}
                        onChange={(e) => setValidatorUserId(e.target.value)}
                      />
                    </div>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Importante</AlertTitle>
                    <AlertDescription>
                      O número será automaticamente marcado como verificado e ativo. Certifique-se de que o número está correto.
                    </AlertDescription>
                  </Alert>

                  <Button
                    onClick={handleCreateValidator}
                    disabled={submitting}
                    className="w-full sm:w-auto"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Criar Validador
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="list">
              <Card>
                <CardHeader>
                  <CardTitle>Validadores Cadastrados</CardTitle>
                  <CardDescription>
                    Lista de todos os números de validação no sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Telefone</TableHead>
                          <TableHead>País</TableHead>
                          <TableHead>Região</TableHead>
                          <TableHead>Validador</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Uso</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validationNumbers?.map((num) => (
                          <TableRow key={num.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                {num.phone_number}
                              </div>
                            </TableCell>
                            <TableCell>{num.country_code}</TableCell>
                            <TableCell>
                              {(num.administrative_divisions as any)?.name || "N/A"}
                            </TableCell>
                            <TableCell>
                              {(num.profiles as any)?.full_name || "Não atribuído"}
                            </TableCell>
                            <TableCell>
                              {num.is_active ? (
                                <Badge variant="default" className="gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Ativo
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1">
                                  <Clock className="h-3 w-3" />
                                  Inativo
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{num.usage_count || 0} usos</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stats">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Total de Validadores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{validationNumbers?.length || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Validadores Ativos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">
                      {validationNumbers?.filter((v) => v.is_active).length || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Total de Validações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">
                      {validationNumbers?.reduce((sum, v) => sum + (v.usage_count || 0), 0) || 0}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Validações por Região */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      Validações por Região
                    </CardTitle>
                    <CardDescription>
                      Top 10 regiões com mais validações
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={validationMetrics?.regionData || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="validations" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Evolução Temporal */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Evolução de Validações (30 dias)
                    </CardTitle>
                    <CardDescription>
                      Histórico de validações realizadas
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={validationMetrics?.timelineData || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="validations" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          dot={{ fill: "hsl(var(--primary))" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Distribuição por Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Status das Validações
                    </CardTitle>
                    <CardDescription>
                      Distribuição de testemunhos por status
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={validationMetrics?.statusData || []}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="hsl(var(--primary))"
                          dataKey="value"
                        >
                          {validationMetrics?.statusData?.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={[
                                "hsl(var(--primary))",
                                "hsl(var(--secondary))",
                                "hsl(var(--accent))",
                                "hsl(var(--muted))"
                              ][index % 4]} 
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Desempenho dos Validadores */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Top Validadores
                    </CardTitle>
                    <CardDescription>
                      Validadores mais ativos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {validationNumbers
                        ?.filter(v => v.usage_count && v.usage_count > 0)
                        ?.sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
                        ?.slice(0, 5)
                        ?.map((validator, index) => (
                          <div key={validator.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium">{validator.phone_number}</p>
                                <p className="text-xs text-muted-foreground">
                                  {(validator.administrative_divisions as any)?.name}
                                </p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="font-bold">
                              {validator.usage_count} validações
                            </Badge>
                          </div>
                        ))}
                      {(!validationNumbers || validationNumbers.filter(v => v.usage_count && v.usage_count > 0).length === 0) && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhuma validação realizada ainda
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    );
  }

  // Validator View - See own stats
  if (role === "validator") {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-green-600" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Meu Dashboard de Validador</h1>
              <p className="text-sm text-muted-foreground">Informações e estatísticas das suas validações</p>
            </div>
          </div>

          {validatorStats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Informações de Contato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Telefone:</span>
                    <span className="font-medium">{validatorStats.phone_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">País:</span>
                    <span className="font-medium">{validatorStats.country_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={validatorStats.is_active ? "default" : "secondary"}>
                      {validatorStats.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Estatísticas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total de validações:</span>
                    <span className="font-bold text-2xl">{validatorStats.usage_count || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Última validação:</span>
                    <span className="font-medium">
                      {validatorStats.last_used_at
                        ? new Date(validatorStats.last_used_at).toLocaleDateString("pt")
                        : "Nunca"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sem dados</AlertTitle>
              <AlertDescription>
                Não foi possível carregar suas informações de validador.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // Citizen View - Request to become validator
  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Tornar-se Validador</h1>
            <p className="text-sm text-muted-foreground">Informações sobre o programa de validadores</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>O que é um Validador?</CardTitle>
            <CardDescription>
              Entenda o papel e responsabilidades de um validador regional
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Responsabilidades:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Validar endereços na sua região</li>
                <li>Responder a solicitações de confirmação via SMS</li>
                <li>Manter informações de contato atualizadas</li>
                <li>Seguir o código de conduta do validador</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Requisitos:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Ser residente permanente da região</li>
                <li>Ter conhecimento local do território</li>
                <li>Disponibilidade para responder solicitações</li>
                <li>Telefone ativo e verificado</li>
              </ul>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Como aplicar?</AlertTitle>
              <AlertDescription>
                Entre em contato com a administração através da página de contato para solicitar ser um validador na sua região.
              </AlertDescription>
            </Alert>

            <Button variant="outline" className="w-full sm:w-auto" asChild>
              <a href="/contact">
                <Phone className="mr-2 h-4 w-4" />
                Entrar em Contato
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ValidatorManagement;
