import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Globe, MapPin, Users, Shield, CheckCircle2, ArrowRight, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: any;
  status: 'pending' | 'in-progress' | 'completed';
}

export default function AdminSystemSetup() {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<string>('countries');

  // Check system setup status
  const { data: setupStatus, isLoading } = useQuery({
    queryKey: ['system-setup-status'],
    queryFn: async () => {
      // Check countries
      const { data: countries } = await supabase
        .from('countries')
        .select('id')
        .eq('is_active', true);

      // Check administrative divisions
      const { data: divisions } = await supabase
        .from('administrative_divisions')
        .select('id');

      // Check if there are admins
      const { data: admins } = await supabase
        .from('user_roles')
        .select('id')
        .eq('role', 'admin');

      // Check if there are regional administrators
      const { data: regionalAdmins } = await supabase
        .from('user_authorization_levels')
        .select('id')
        .gte('current_level', 2);

      return {
        hasCountries: (countries?.length || 0) > 0,
        countriesCount: countries?.length || 0,
        hasDivisions: (divisions?.length || 0) > 0,
        divisionsCount: divisions?.length || 0,
        hasAdmins: (admins?.length || 0) > 0,
        adminsCount: admins?.length || 0,
        hasRegionalAdmins: (regionalAdmins?.length || 0) > 0,
        regionalAdminsCount: regionalAdmins?.length || 0
      };
    }
  });

  const setupSteps: SetupStep[] = [
    {
      id: 'countries',
      title: 'Configurar Países',
      description: 'Ative e configure os países onde o sistema irá operar',
      icon: Globe,
      status: setupStatus?.hasCountries ? 'completed' : 'pending'
    },
    {
      id: 'divisions',
      title: 'Divisões Administrativas',
      description: 'Importe as divisões administrativas (províncias, territórios, comunas)',
      icon: MapPin,
      status: setupStatus?.hasDivisions ? 'completed' : 'pending'
    },
    {
      id: 'admins',
      title: 'Administradores Globais',
      description: 'Crie administradores com acesso total ao sistema',
      icon: Shield,
      status: setupStatus?.hasAdmins ? 'completed' : 'pending'
    },
    {
      id: 'regional',
      title: 'Administradores Regionais',
      description: 'Atribua funcionários para gerenciar regiões específicas',
      icon: Users,
      status: setupStatus?.hasRegionalAdmins ? 'completed' : 'pending'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in-progress': return 'default';
      default: return 'secondary';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Configuração Inicial do Sistema</h1>
            <p className="text-muted-foreground">
              Configure o sistema para operação multi-regional e multi-nacional
            </p>
          </div>
        </div>

        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Modelo Hierárquico de Gestão</AlertTitle>
          <AlertDescription>
            O sistema opera em 5 níveis de autorização: Nível 1 (Local) → Nível 2 (Comunal) → 
            Nível 3 (Territorial) → Nível 4 (Provincial) → Nível 5 (Nacional). Cada nível superior 
            supervisiona os níveis inferiores em sua jurisdição.
          </AlertDescription>
        </Alert>

        {/* Progress Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Progresso da Configuração</CardTitle>
            <CardDescription>Siga estas etapas para configurar o sistema completo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {setupSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <Card key={step.id} className="relative">
                    <CardContent className="pt-6">
                      <div className="flex flex-col items-center text-center space-y-3">
                        <div className={`p-3 rounded-full ${
                          step.status === 'completed' 
                            ? 'bg-green-100 text-green-600' 
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{step.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {step.description}
                          </p>
                        </div>
                        <Badge variant={getStatusColor(step.status) as any}>
                          {step.status === 'completed' ? 'Concluído' : 'Pendente'}
                        </Badge>
                      </div>
                    </CardContent>
                    {index < setupSteps.length - 1 && (
                      <div className="hidden lg:block absolute top-1/2 -right-8 transform -translate-y-1/2">
                        <ArrowRight className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Configuration Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="hierarchy">Hierarquia</TabsTrigger>
            <TabsTrigger value="workflow">Fluxo de Trabalho</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Status Atual do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="h-5 w-5 text-primary" />
                      <p className="text-sm font-medium">Países Ativos</p>
                    </div>
                    <p className="text-3xl font-bold">{setupStatus?.countriesCount || 0}</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      <p className="text-sm font-medium">Divisões Admin.</p>
                    </div>
                    <p className="text-3xl font-bold">{setupStatus?.divisionsCount || 0}</p>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-5 w-5 text-primary" />
                      <p className="text-sm font-medium">Admins Globais</p>
                    </div>
                    <p className="text-3xl font-bold">{setupStatus?.adminsCount || 0}</p>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-5 w-5 text-primary" />
                      <p className="text-sm font-medium">Admins Regionais</p>
                    </div>
                    <p className="text-3xl font-bold">{setupStatus?.regionalAdminsCount || 0}</p>
                  </div>
                </div>

                <div className="space-y-2 mt-6">
                  <h3 className="font-semibold">Próximas Ações Recomendadas:</h3>
                  {!setupStatus?.hasCountries && (
                    <Button variant="outline" className="w-full justify-start" asChild>
                      <a href="/admin/country-config">
                        <Globe className="h-4 w-4 mr-2" />
                        Configurar Países
                      </a>
                    </Button>
                  )}
                  {!setupStatus?.hasDivisions && (
                    <Button variant="outline" className="w-full justify-start" asChild>
                      <a href="/admin/import-divisions">
                        <MapPin className="h-4 w-4 mr-2" />
                        Importar Divisões Administrativas
                      </a>
                    </Button>
                  )}
                  {!setupStatus?.hasAdmins && (
                    <Button variant="outline" className="w-full justify-start" asChild>
                      <a href="/admin/user-management">
                        <Shield className="h-4 w-4 mr-2" />
                        Criar Administradores
                      </a>
                    </Button>
                  )}
                  {!setupStatus?.hasRegionalAdmins && setupStatus?.hasAdmins && (
                    <Button variant="outline" className="w-full justify-start" asChild>
                      <a href="/admin/user-management">
                        <Users className="h-4 w-4 mr-2" />
                        Atribuir Administradores Regionais
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hierarchy" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Estrutura Hierárquica do Sistema</CardTitle>
                <CardDescription>
                  Modelo de 5 níveis com supervisão hierárquica
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { level: 5, title: 'Nacional', role: 'Administrador Nacional', scope: 'Todo o país', color: 'bg-red-100 text-red-800' },
                    { level: 4, title: 'Provincial', role: 'Administrador Provincial', scope: 'Província/Estado', color: 'bg-orange-100 text-orange-800' },
                    { level: 3, title: 'Territorial', role: 'Administrador Territorial', scope: 'Território/Município', color: 'bg-yellow-100 text-yellow-800' },
                    { level: 2, title: 'Comunal', role: 'Administrador Comunal', scope: 'Comuna/Distrito', color: 'bg-green-100 text-green-800' },
                    { level: 1, title: 'Local', role: 'Agente Local', scope: 'Quartier/Bairro', color: 'bg-blue-100 text-blue-800' }
                  ].map((item) => (
                    <div key={item.level} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className={`px-3 py-1 rounded-full ${item.color} font-bold`}>
                        N{item.level}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.role}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{item.scope}</p>
                        <p className="text-xs text-muted-foreground">
                          Supervisiona: Nível {item.level - 1 > 0 ? item.level - 1 : '-'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <Alert className="mt-6">
                  <AlertTitle>Delegação de Autoridade</AlertTitle>
                  <AlertDescription>
                    Cada nível pode criar e gerenciar usuários do nível imediatamente inferior 
                    dentro de sua jurisdição geográfica. Um Admin Provincial (N4) pode criar 
                    Admins Territoriais (N3) em sua província.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workflow" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Fluxo de Implementação Recomendado</CardTitle>
                <CardDescription>Siga esta sequência para implementação continental</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4">
                  <li className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      1
                    </div>
                    <div>
                      <p className="font-semibold">Configuração de Países</p>
                      <p className="text-sm text-muted-foreground">
                        Ative os países (Angola, Moçambique, etc.) e configure rótulos de níveis administrativos 
                        (Província, Território, Comuna, Quartier)
                      </p>
                    </div>
                  </li>

                  <li className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      2
                    </div>
                    <div>
                      <p className="font-semibold">Importação de Divisões</p>
                      <p className="text-sm text-muted-foreground">
                        Importe via CSV todas as divisões administrativas de cada país 
                        (dados oficiais do INE ou órgãos governamentais)
                      </p>
                    </div>
                  </li>

                  <li className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      3
                    </div>
                    <div>
                      <p className="font-semibold">Super Admin Inicial</p>
                      <p className="text-sm text-muted-foreground">
                        Promova o primeiro usuário a Admin Global (Nível 5) com acesso total ao sistema
                      </p>
                    </div>
                  </li>

                  <li className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      4
                    </div>
                    <div>
                      <p className="font-semibold">Admins Nacionais por País</p>
                      <p className="text-sm text-muted-foreground">
                        Crie um Admin Nacional (Nível 5) para cada país com jurisdição sobre todo o território nacional
                      </p>
                    </div>
                  </li>

                  <li className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      5
                    </div>
                    <div>
                      <p className="font-semibold">Delegação Cascata</p>
                      <p className="text-sm text-muted-foreground">
                        Admins Nacionais criam Admins Provinciais (N4), que criam Territoriais (N3), 
                        que criam Comunais (N2), que criam Agentes Locais (N1)
                      </p>
                    </div>
                  </li>

                  <li className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      6
                    </div>
                    <div>
                      <p className="font-semibold">Números de Validação</p>
                      <p className="text-sm text-muted-foreground">
                        Configure números de telefone para validação SMS em cada divisão administrativa
                      </p>
                    </div>
                  </li>
                </ol>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
