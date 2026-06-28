import { Bell, Search, User, Star, MapPin, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationCenter } from "@/components/NotificationCenter";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePrimaryResidence } from "@/hooks/usePrimaryResidence";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const DashboardHeader = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role } = useUserRole();
  const { t } = useLanguage();
  const { primaryResidence, requiresPrimarySelection, totalAddresses, formatAddress } = usePrimaryResidence();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/login");
      toast({
        title: t("logout_success"),
        description: t("logout_success_desc"),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("logout_error"),
        description: t("logout_error_desc"),
      });
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-3 px-3 sm:gap-4 sm:px-6">
        <SidebarTrigger className="md:hidden" />
        <div className="flex flex-1 items-center gap-3 sm:gap-4 min-w-0">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder={t("search_placeholder")} className="w-full bg-muted/50 pl-8" />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Primary Residence Indicator */}
          {totalAddresses > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {requiresPrimarySelection ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/identities")}
                      className="hidden md:flex items-center gap-1.5 border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span className="text-xs">{t("select_primary_residence") || "Selecionar Residência"}</span>
                    </Button>
                  ) : primaryResidence ? (
                    <Badge
                      variant="outline"
                      className="hidden lg:flex items-center gap-1.5 cursor-pointer border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                      onClick={() => navigate(`/identity/${primaryResidence.id}`)}
                    >
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      <span className="max-w-[150px] truncate text-xs">{primaryResidence.code}</span>
                    </Badge>
                  ) : null}
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[300px]">
                  {requiresPrimarySelection ? (
                    <div className="text-sm">
                      <p className="font-medium text-amber-600">{t("primary_residence_required") || "Residência Principal Obrigatória"}</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        {t("primary_residence_required_desc") || "Você deve selecionar uma residência principal para homologação junto às autoridades."}
                      </p>
                    </div>
                  ) : primaryResidence ? (
                    <div className="text-sm">
                      <p className="font-medium flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                        {t("primary_residence") || "Residência Principal"}
                      </p>
                      <p className="text-muted-foreground text-xs mt-1">{formatAddress(primaryResidence)}</p>
                    </div>
                  ) : null}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {role && (
            <Badge
              variant={role === "admin" ? "default" : role === "validator" ? "secondary" : "outline"}
              className="mr-1 hidden sm:inline-flex"
            >
              {role === "admin"
                ? t("role_admin")
                : role === "moderator"
                ? t("role_moderator")
                : role === "validator"
                ? t("role_validator")
                : t("role_citizen")}
            </Badge>
          )}

          <LanguageSelector />

          <ThemeToggle />

          <NotificationCenter />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-background z-50">
              <DropdownMenuLabel>{t("my_account")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")}>{t("profile")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/user-levels")}>{t("authorization_levels")}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>{t("logout")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
