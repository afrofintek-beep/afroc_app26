import { Home, Users, FileText, Shield, BarChart3, TrendingUp, FileCheck, Download, ShieldCheck, MessageSquare, Languages, MapPin, BookOpen, Smartphone, TestTube, Grid3X3, Share2, Timer } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import logo from "@/assets/afroloc-symbol.png";
import { useAuthorizationLevel } from "@/hooks/useAuthorizationLevel";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

// Responsive sidebar with shadcn Sidebar component (requires SidebarProvider)
const DashboardSidebarResponsive = () => {
  const { data: authLevel } = useAuthorizationLevel();
  const [isValidator, setIsValidator] = useState(false);
  const { state } = useSidebar();
  const userLevel = authLevel?.current_level || 1;
  const isAdmin = userLevel >= 2;
  const { t } = useLanguage();
  const isCollapsed = state === "collapsed";

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

  const mainNavItems = [
    { to: "/dashboard", icon: Home, label: t("nav_dashboard") },
    { to: "/identities", icon: Shield, label: t("nav_identities") },
    { to: "/my-afroloc", icon: Share2, label: "Meu AfroLoc" },
    { to: "/user-levels", icon: TrendingUp, label: t("nav_user_levels") },
    { to: "/brand-guidelines", icon: BookOpen, label: "Brand Book" },
  ];

  const validatorNavItems = isValidator ? [
    { to: "/regional-validation", icon: ShieldCheck, label: t("nav_regional_validation") },
    { to: "/validations-dashboard", icon: MessageSquare, label: t("nav_sms_validations") }
  ] : [];

  const adminNavItems = isAdmin ? [
    { to: "/grid-management", icon: Grid3X3, label: "Gestão de Grid" },
    { to: "/admin/system-setup", icon: Shield, label: "Configuração Inicial" },
    { to: "/admin/user-management", icon: Users, label: "Gerenciar Usuários" },
    { to: "/admin/regional-management", icon: MapPin, label: "Gestão Regional" },
    { to: "/admin/documents", icon: FileCheck, label: t("nav_document_review") },
    { to: "/admin/contract-downloads", icon: Download, label: t("nav_contract_downloads") },
    { to: "/admin/reports", icon: BarChart3, label: t("nav_reports_analytics") },
    { to: "/admin/security", icon: Shield, label: t("nav_security_monitor") },
    { to: "/admin/translations", icon: Languages, label: t("nav_translations") },
    { to: "/admin/import-divisions", icon: FileText, label: t("nav_import_divisions") },
    { to: "/admin/telecom-operators", icon: Users, label: t("nav_telecom_operators") },
    { to: "/admin/validation-numbers", icon: Shield, label: t("nav_validation_numbers") },
    { to: "/manual-download", icon: BookOpen, label: "Manual de Apoio" },
    { to: "/app-download", icon: Smartphone, label: "Download App" },
    { to: "/address-test", icon: TestTube, label: "Teste de Endereços" },
    { to: "/temp-address-manager", icon: Timer, label: "Endereços Temporários" }
  ] : [];

  return (
    <Sidebar collapsible="icon" className="transition-all duration-300 ease-in-out">
      <SidebarHeader className="border-b border-border">
        <div className="flex h-16 items-center px-4 transition-all duration-300">
          <img 
            src={logo} 
            alt="AFROLOC" 
            className="h-8 w-8 object-cover rounded-lg shadow-md ring-1 ring-primary/20 transition-all duration-300 animate-fade-in" 
          />
          {!isCollapsed && (
            <span className="ml-3 text-lg font-bold text-primary animate-fade-in">AFROLOC</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="transition-opacity duration-300">
            {isCollapsed ? "" : <span className="animate-fade-in">{t("nav_main")}</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild className="transition-all duration-300 hover:scale-105">
                    <NavLink to={item.to} icon={item.icon}>
                      {!isCollapsed && (
                        <span className="animate-fade-in transition-all duration-300">
                          {item.label}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {validatorNavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-green-600 transition-opacity duration-300">
              {isCollapsed ? "" : <span className="animate-fade-in">{t("nav_validator")}</span>}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {validatorNavItems.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild className="border-l-2 border-green-500/50 bg-green-500/5 transition-all duration-300 hover:scale-105 hover:bg-green-500/10">
                      <NavLink to={item.to} icon={item.icon}>
                        {!isCollapsed && (
                          <span className="animate-fade-in transition-all duration-300">
                            {item.label}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {adminNavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-primary transition-opacity duration-300">
              {isCollapsed ? "" : <span className="animate-fade-in">{t("nav_admin")}</span>}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild className="border-l-2 border-primary/50 bg-primary/5 transition-all duration-300 hover:scale-105 hover:bg-primary/10">
                      <NavLink to={item.to} icon={item.icon}>
                        {!isCollapsed && (
                          <span className="animate-fade-in transition-all duration-300">
                            {item.label}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
};

export default DashboardSidebarResponsive;
