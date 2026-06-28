import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import { AuthorizationLevelProgress } from "@/components/AuthorizationLevelProgress";
import { useAuthorizationLevel } from "@/hooks/useAuthorizationLevel";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/contexts/LanguageContext";
import { Users, Shield, FileCheck, Activity, Home, PlusCircle, MapPin, Eye, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OnboardingTutorial } from "@/components/OnboardingTutorial";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data: authLevel } = useAuthorizationLevel();
  const { role, isCitizen } = useUserRole();
  const { t } = useLanguage();
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/landing");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchUserName = async () => {
      if (user?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .single();
        
        if (data?.full_name) {
          setUserName(data.full_name);
        }
      }
    };
    fetchUserName();
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <OnboardingTutorial onComplete={() => console.log("Onboarding completed")} />
      <DashboardLayout>
        {/* Background mesh gradient */}
        <div className="fixed inset-0 pointer-events-none bg-gradient-mesh opacity-50 -z-10"></div>
        
        <div className="relative w-full max-w-full overflow-hidden">
          {/* Hero Header with Premium Gradient */}
          <div className="mb-8 animate-fade-in">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-10 shadow-premium">
              <div className="absolute inset-0 bg-dots-pattern opacity-10"></div>
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-glow/20 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-accent/20 rounded-full blur-3xl"></div>
              
                <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="animate-float">
                    <Sparkles className="h-8 w-8 text-white drop-shadow-lg" />
                  </div>
                  <h1 className="text-4xl md:text-5xl font-display font-bold text-white tracking-tight">
                    {userName ? `${t("welcome")}, ${userName}!` : t("dashboard_title")}
                  </h1>
                </div>
                <p className="text-white/90 text-xl max-w-2xl font-medium">
                  {t("manage_your_afroloc_addresses")}
                </p>
              </div>
            </div>
          </div>

          {/* Citizen Quick Actions - Premium Cards */}
          {isCitizen && (
            <div className="mb-8 animate-scale-in">
              <Card className="glass-strong border-border/50 shadow-premium">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-3xl font-display">
                    <div className="p-2 rounded-xl bg-gradient-primary animate-float">
                      <Home className="h-7 w-7 text-white" />
                    </div>
                    {t("quick_actions")}
                  </CardTitle>
                  <CardDescription className="text-base mt-2">
                    {t("quick_actions_desc")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5 sm:grid-cols-2">
                  <Button 
                    onClick={() => navigate('/identities/create')} 
                    size="lg"
                    className="h-auto py-8 flex flex-col items-center gap-4 bg-gradient-primary hover:scale-105 shadow-premium transition-all duration-500 group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 shimmer"></div>
                    <div className="p-4 rounded-2xl bg-white/20 group-hover:bg-white/30 animate-float transition-all">
                      <PlusCircle className="h-10 w-10" />
                    </div>
                    <div className="text-center relative z-10">
                      <div className="font-display font-bold text-xl">{t("create_new_identity")}</div>
                      <div className="text-sm text-white/90 mt-1.5">{t("verify_new_identity_desc")}</div>
                    </div>
                  </Button>
                  <Button 
                    variant="outline"
                    size="lg"
                    onClick={() => navigate('/identities')}
                    className="h-auto py-8 flex flex-col items-center gap-4 glass border-2 border-border/50 hover:border-primary hover:shadow-glow hover:scale-105 transition-all duration-500 group"
                  >
                    <div className="p-4 rounded-2xl bg-primary/10 group-hover:bg-primary/20 animate-float transition-all" style={{ animationDelay: '0.2s' }}>
                      <Eye className="h-10 w-10 text-primary" />
                    </div>
                    <div className="text-center">
                      <div className="font-display font-bold text-xl">{t("view_my_identities")}</div>
                      <div className="text-sm text-muted-foreground mt-1.5">{t("recent_activity_desc")}</div>
                    </div>
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Authorization Level Progress - only for non-citizens */}
          {!isCitizen && (
            <div className="mb-8 animate-fade-in" style={{ animationDelay: '100ms' }}>
              <AuthorizationLevelProgress authLevel={authLevel || {}} />
            </div>
          )}
          
          {!isCitizen && (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4 mb-8 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="glass-strong border border-border/50 rounded-2xl p-6 shadow-soft hover:shadow-elegant transition-all duration-300 group">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-primary animate-float group-hover:scale-110 transition-transform">
                  <Users className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{t("total_users")}</p>
              <h3 className="text-3xl font-display font-bold mb-2">2,543</h3>
              <p className="text-xs text-green-600 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +12.5% desde último mês
              </p>
            </div>
            
            <div className="glass-strong border border-border/50 rounded-2xl p-6 shadow-soft hover:shadow-elegant transition-all duration-300 group">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-secondary animate-float group-hover:scale-110 transition-transform" style={{ animationDelay: '0.2s' }}>
                  <Shield className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{t("active_identities")}</p>
              <h3 className="text-3xl font-display font-bold mb-2">1,892</h3>
              <p className="text-xs text-green-600 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +8.2% desde último mês
              </p>
            </div>
            
            <div className="glass-strong border border-border/50 rounded-2xl p-6 shadow-soft hover:shadow-elegant transition-all duration-300 group">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-accent animate-float group-hover:scale-110 transition-transform" style={{ animationDelay: '0.4s' }}>
                  <FileCheck className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{t("verified_documents")}</p>
              <h3 className="text-3xl font-display font-bold mb-2">4,231</h3>
              <p className="text-xs text-green-600 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +23.1% desde último mês
              </p>
            </div>
            
            <div className="glass-strong border border-border/50 rounded-2xl p-6 shadow-soft hover:shadow-elegant transition-all duration-300 group">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-warm animate-float group-hover:scale-110 transition-transform" style={{ animationDelay: '0.6s' }}>
                  <Activity className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{t("system_status")}</p>
              <h3 className="text-3xl font-display font-bold mb-2">99.9%</h3>
              <p className="text-xs text-muted-foreground">{t("uptime")}</p>
            </div>
          </div>
          )}
          
          {!isCitizen && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7 animate-fade-in" style={{ animationDelay: '300ms' }}>
            <Card className="col-span-4 glass-strong border border-border/50 shadow-premium hover:shadow-xl transition-all duration-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-2xl font-display">
                  <div className="p-2 rounded-xl bg-gradient-primary animate-float">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                  {t("recent_activity")}
                </CardTitle>
                <CardDescription className="text-base">{t("recent_activity_desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div 
                      key={i} 
                      className="group flex items-center gap-4 rounded-2xl glass border border-border/50 p-5 hover:border-primary/50 hover:shadow-glow transition-all duration-500 hover:scale-[1.02]"
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-elegant group-hover:shadow-glow group-hover:scale-110 transition-all animate-float" style={{ animationDelay: `${i * 0.1}s` }}>
                        <Shield className="h-7 w-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-display font-semibold">{t("identity_verification")} #{1000 + i}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t("completed_hours_ago").replace('{hours}', i.toString())}</p>
                      </div>
                      <div className="px-4 py-2 rounded-xl bg-green-100 text-green-700 text-sm font-semibold shadow-soft">
                        {t("approved")}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card className="col-span-3 glass-strong border border-border/50 shadow-premium hover:shadow-xl transition-all duration-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-2xl font-display">
                  <div className="p-2 rounded-xl bg-gradient-warm animate-float" style={{ animationDelay: '0.3s' }}>
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  {t("quick_actions")}
                </CardTitle>
                <CardDescription className="text-base">{t("quick_actions_common")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <button 
                  onClick={() => {
                    toast({ title: t("quick_action_verify_title"), description: t("quick_action_verify_desc") });
                    navigate('/verify-identity');
                  }}
                  className="group w-full rounded-2xl glass border border-border/50 p-5 text-left transition-all duration-500 hover:border-primary hover:shadow-glow hover:scale-105"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-gradient-primary group-hover:shadow-glow transition-all animate-float">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-display font-semibold text-base">{t("verify_new_identity")}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">{t("verify_new_identity_desc")}</p>
                    </div>
                  </div>
                </button>
                <button 
                  onClick={() => {
                    toast({ title: t("quick_action_report_title"), description: t("quick_action_report_desc") });
                    navigate('/admin/reports');
                  }}
                  className="group w-full rounded-2xl glass border border-border/50 p-5 text-left transition-all duration-500 hover:border-primary hover:shadow-glow hover:scale-105"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-gradient-secondary group-hover:shadow-glow transition-all animate-float" style={{ animationDelay: '0.1s' }}>
                      <FileCheck className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-display font-semibold text-base">{t("generate_report")}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">{t("generate_report_desc")}</p>
                    </div>
                  </div>
                </button>
                <button 
                  onClick={() => {
                    toast({ title: t("quick_action_users_title"), description: t("quick_action_users_desc") });
                    navigate('/admin/user-management');
                  }}
                  className="group w-full rounded-2xl glass border border-border/50 p-5 text-left transition-all duration-500 hover:border-primary hover:shadow-glow hover:scale-105"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-gradient-accent group-hover:shadow-glow transition-all animate-float" style={{ animationDelay: '0.2s' }}>
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-display font-semibold text-base">{t("manage_users")}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">{t("manage_users_desc")}</p>
                    </div>
                  </div>
                </button>
              </CardContent>
            </Card>
          </div>
          )}
        </div>
      </DashboardLayout>
    </>
  );
};

export default Index;
