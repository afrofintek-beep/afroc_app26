import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface NavLinkProps {
  to: string;
  children: React.ReactNode;
  icon?: LucideIcon;
}

export function NavLink({ to, children, icon: Icon }: NavLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-300 hover:bg-accent",
        isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-accent-foreground"
      )}
    >
      {Icon && <Icon className="h-4 w-4 flex-shrink-0 transition-transform duration-300" />}
      {children}
    </Link>
  );
}
