import { Home, Users, FileText, Shield, BarChart3, TrendingUp, FileCheck, Download, ShieldCheck, MessageSquare, UserCheck, MapPin, BookOpen, Smartphone, Target, Grid3X3, ScrollText, Radio, Star, AlertTriangle, FileSpreadsheet, Library, FlaskConical, TestTube, UserPlus } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import logo from "@/assets/afroloc-symbol.png";
import { useAuthorizationLevel } from "@/hooks/useAuthorizationLevel";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

// Simple sidebar without shadcn Sidebar component (for backwards compatibility)
const DashboardSidebar = () => {
  const { data: authLevel } = useAuthorizationLevel();
  const [isValidator, setIsValidator] = useState(false);
  const userLevel = authLevel?.current_level || 1;
  const isAdmin = userLevel >= 2;
  const { t } = useLanguage();

  useEffect(() => {
    const checkValidatorStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: validationNumbers } = await supabase
          .from("validation_phone_numbers")
          .select("id")
          .eq("validator_user_id", user.id)
          .eq("is_active", true)
          .limit(1);

        setIsValidator((validationNumbers?.length || 0) > 0);
      } else {
        setIsValidator(false);
      }
    };

    checkValidatorStatus();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkValidatorStatus();
    });

    return () => subscription.unsubscribe();
  }, []);

  const navItems = [
    { to: "/dashboard", icon: Home, label: t("nav_dashboard") },
    { to: "/my-addresses", icon: MapPin, label: t("nav_my_addresses") },
    { to: "/identities", icon: Shield, label: t("nav_identities") },
    { to: "/witness-reputation", icon: Star, label: t("witness_reputation_score") || "Reputação" },
    { to: "/user-levels", icon: TrendingUp, label: t("nav_user_levels") },
    { to: "/brand-guidelines", icon: BookOpen, label: "Brand Book" },
    { to: "/validators", icon: UserCheck, label: "Validadores" },
    ...(isValidator ? [
      { to: "/regional-validation", icon: ShieldCheck, label: t("nav_regional_validation"), validatorOnly: true },
      { to: "/validations-dashboard", icon: MessageSquare, label: t("nav_sms_validations"), validatorOnly: true }
    ] : []),
    ...(isAdmin || userLevel >= 3 ? [
      { to: "/authority/gps-validation", icon: MapPin, label: "Validação GPS", authorityOnly: true },
    ] : []),
    ...(isAdmin ? [
      { to: "/geospatial-grid", icon: Grid3X3, label: "Grid Geoespacial", adminOnly: true },
      { to: "/certification-kpis", icon: Target, label: "KPIs de Certificação", adminOnly: true },
      { to: "/admin/documents", icon: FileCheck, label: t("nav_document_review"), adminOnly: true },
      { to: "/admin/document-library", icon: Library, label: "Biblioteca de Docs", adminOnly: true },
      { to: "/admin/contract-downloads", icon: Download, label: t("nav_contract_downloads"), adminOnly: true },
      { to: "/admin/user-management", icon: Users, label: "Gestão de Usuários", adminOnly: true },
      { to: "/admin/role-approvals", icon: Shield, label: "Aprovações", adminOnly: true },
      { to: "/kpis-export", icon: FileSpreadsheet, label: t("kpis_export") || "Export KPIs", adminOnly: true },
      { to: "/admin/reports", icon: BarChart3, label: t("nav_reports_analytics"), adminOnly: true },
      { to: "/admin/security", icon: Shield, label: t("nav_security_monitor"), adminOnly: true },
      { to: "/admin/security-audit", icon: ScrollText, label: "Logs de Auditoria", adminOnly: true },
      { to: "/admin/fraud-flags", icon: AlertTriangle, label: t("fraud_flags_management") || "Flags de Fraude", adminOnly: true },
      { to: "/admin/import-divisions", icon: FileText, label: t("nav_import_divisions"), adminOnly: true },
      { to: "/admin/telecom-operators", icon: Users, label: t("nav_telecom_operators"), adminOnly: true },
      { to: "/admin/cell-towers", icon: Radio, label: "Torres de Celular", adminOnly: true },
      { to: "/admin/validation-numbers", icon: Shield, label: t("nav_validation_numbers"), adminOnly: true },
      { to: "/manual-download", icon: BookOpen, label: "Manual de Apoio", adminOnly: true },
      { to: "/app-download", icon: Smartphone, label: "Download App", adminOnly: true },
      { to: "/test-environment", icon: FlaskConical, label: "Ambiente de Testes", adminOnly: true },
      { to: "/admin/yamioo-agents", icon: UserPlus, label: "Agentes Yamioo", adminOnly: true },
      { to: "/address-test", icon: TestTube, label: "Teste de Endereços", adminOnly: true }
    ] : []),
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card transition-all duration-300">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center border-b border-border px-6 transition-all duration-300">
          <img src={logo} alt="AFROLOC" className="h-8 w-8 object-cover rounded-lg shadow-md ring-1 ring-primary/20 animate-fade-in" />
          <span className="ml-3 text-lg font-bold text-primary">AFROLOC</span>
        </div>
        
        <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
          {navItems.map((item) => (
            <div
              key={item.to}
              className={
                (item as any).adminOnly 
                  ? "border-l-2 border-primary/50 bg-primary/5 rounded-r-md transition-all duration-300 hover:bg-primary/10" 
                  : (item as any).validatorOnly
                  ? "border-l-2 border-green-500/50 bg-green-500/5 rounded-r-md transition-all duration-300 hover:bg-green-500/10"
                  : (item as any).authorityOnly
                  ? "border-l-2 border-orange-500/50 bg-orange-500/5 rounded-r-md transition-all duration-300 hover:bg-orange-500/10"
                  : ""
              }
            >
              <NavLink to={item.to} icon={item.icon}>
                {item.label}
              </NavLink>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
