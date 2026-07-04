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
import { useLanguage } from '@/contexts/LanguageContext';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: any;
  status: 'pending' | 'in-progress' | 'completed';
}

export default function AdminSystemSetup() {
  const { t } = useLanguage();
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
      title: t('syssetup_step_countries_title'),
      description: t('syssetup_step_countries_desc'),
      icon: Globe,
      status: setupStatus?.hasCountries ? 'completed' : 'pending'
    },
    {
      id: 'divisions',
      title: t('syssetup_step_divisions_title'),
      description: t('syssetup_step_divisions_desc'),
      icon: MapPin,
      status: setupStatus?.hasDivisions ? 'completed' : 'pending'
    },
    {
      id: 'admins',
      title: t('syssetup_step_admins_title'),
      description: t('syssetup_step_admins_desc'),
      icon: Shield,
      status: setupStatus?.hasAdmins ? 'completed' : 'pending'
    },
    {
      id: 'regional',
      title: t('syssetup_step_regional_title'),
      description: t('syssetup_step_regional_desc'),
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
            <h1 className="text-3xl font-bold">{t('syssetup_page_title')}</h1>
            <p className="text-muted-foreground">
              {t('syssetup_page_subtitle')}
            </p>
          </div>
        </div>

        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>{t('syssetup_hier_alert_title')}</AlertTitle>
          <AlertDescription>
            {t('syssetup_hier_alert_desc')}
          </AlertDescription>
        </Alert>

        {/* Progress Overview */}
        <Card>
          <CardHeader>
            <CardTitle>{t('syssetup_progress_title')}</CardTitle>
            <CardDescription>{t('syssetup_progress_desc')}</CardDescription>
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
                          {step.status === 'completed' ? t('syssetup_status_completed') : t('syssetup_status_pending')}
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
            <TabsTrigger value="overview">{t('syssetup_tab_overview')}</TabsTrigger>
            <TabsTrigger value="hierarchy">{t('syssetup_tab_hierarchy')}</TabsTrigger>
            <TabsTrigger value="workflow">{t('syssetup_tab_workflow')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('syssetup_status_card_title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="h-5 w-5 text-primary" />
                      <p className="text-sm font-medium">{t('syssetup_stat_active_countries')}</p>
                    </div>
                    <p className="text-3xl font-bold">{setupStatus?.countriesCount || 0}</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      <p className="text-sm font-medium">{t('syssetup_stat_admin_divisions')}</p>
                    </div>
                    <p className="text-3xl font-bold">{setupStatus?.divisionsCount || 0}</p>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-5 w-5 text-primary" />
                      <p className="text-sm font-medium">{t('syssetup_stat_global_admins')}</p>
                    </div>
                    <p className="text-3xl font-bold">{setupStatus?.adminsCount || 0}</p>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-5 w-5 text-primary" />
                      <p className="text-sm font-medium">{t('syssetup_stat_regional_admins')}</p>
                    </div>
                    <p className="text-3xl font-bold">{setupStatus?.regionalAdminsCount || 0}</p>
                  </div>
                </div>

                <div className="space-y-2 mt-6">
                  <h3 className="font-semibold">{t('syssetup_next_actions')}</h3>
                  {!setupStatus?.hasCountries && (
                    <Button variant="outline" className="w-full justify-start" asChild>
                      <a href="/admin/country-config">
                        <Globe className="h-4 w-4 mr-2" />
                        {t('syssetup_action_config_countries')}
                      </a>
                    </Button>
                  )}
                  {!setupStatus?.hasDivisions && (
                    <Button variant="outline" className="w-full justify-start" asChild>
                      <a href="/admin/import-divisions">
                        <MapPin className="h-4 w-4 mr-2" />
                        {t('syssetup_action_import_divisions')}
                      </a>
                    </Button>
                  )}
                  {!setupStatus?.hasAdmins && (
                    <Button variant="outline" className="w-full justify-start" asChild>
                      <a href="/admin/user-management">
                        <Shield className="h-4 w-4 mr-2" />
                        {t('syssetup_action_create_admins')}
                      </a>
                    </Button>
                  )}
                  {!setupStatus?.hasRegionalAdmins && setupStatus?.hasAdmins && (
                    <Button variant="outline" className="w-full justify-start" asChild>
                      <a href="/admin/user-management">
                        <Users className="h-4 w-4 mr-2" />
                        {t('syssetup_action_assign_regional')}
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
                <CardTitle>{t('syssetup_hier_card_title')}</CardTitle>
                <CardDescription>
                  {t('syssetup_hier_card_desc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { level: 5, title: t('syssetup_lvl5_title'), role: t('syssetup_lvl5_role'), scope: t('syssetup_lvl5_scope'), color: 'bg-red-100 text-red-800' },
                    { level: 4, title: t('syssetup_lvl4_title'), role: t('syssetup_lvl4_role'), scope: t('syssetup_lvl4_scope'), color: 'bg-orange-100 text-orange-800' },
                    { level: 3, title: t('syssetup_lvl3_title'), role: t('syssetup_lvl3_role'), scope: t('syssetup_lvl3_scope'), color: 'bg-yellow-100 text-yellow-800' },
                    { level: 2, title: t('syssetup_lvl2_title'), role: t('syssetup_lvl2_role'), scope: t('syssetup_lvl2_scope'), color: 'bg-green-100 text-green-800' },
                    { level: 1, title: t('syssetup_lvl1_title'), role: t('syssetup_lvl1_role'), scope: t('syssetup_lvl1_scope'), color: 'bg-blue-100 text-blue-800' }
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
                          {t('syssetup_supervises_level')} {item.level - 1 > 0 ? item.level - 1 : '-'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <Alert className="mt-6">
                  <AlertTitle>{t('syssetup_delegation_title')}</AlertTitle>
                  <AlertDescription>
                    {t('syssetup_delegation_desc')}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workflow" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('syssetup_workflow_card_title')}</CardTitle>
                <CardDescription>{t('syssetup_workflow_card_desc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4">
                  <li className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      1
                    </div>
                    <div>
                      <p className="font-semibold">{t('syssetup_wf1_title')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('syssetup_wf1_desc')}
                      </p>
                    </div>
                  </li>

                  <li className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      2
                    </div>
                    <div>
                      <p className="font-semibold">{t('syssetup_wf2_title')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('syssetup_wf2_desc')}
                      </p>
                    </div>
                  </li>

                  <li className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      3
                    </div>
                    <div>
                      <p className="font-semibold">{t('syssetup_wf3_title')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('syssetup_wf3_desc')}
                      </p>
                    </div>
                  </li>

                  <li className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      4
                    </div>
                    <div>
                      <p className="font-semibold">{t('syssetup_wf4_title')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('syssetup_wf4_desc')}
                      </p>
                    </div>
                  </li>

                  <li className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      5
                    </div>
                    <div>
                      <p className="font-semibold">{t('syssetup_wf5_title')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('syssetup_wf5_desc')}
                      </p>
                    </div>
                  </li>

                  <li className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      6
                    </div>
                    <div>
                      <p className="font-semibold">{t('syssetup_wf6_title')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('syssetup_wf6_desc')}
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
