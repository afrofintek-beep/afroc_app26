import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import DashboardSidebarResponsive from "@/components/DashboardSidebarResponsive";
import DashboardHeader from "@/components/DashboardHeader";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background transition-all duration-300">
        <DashboardSidebarResponsive />
        <div className="flex-1 flex flex-col transition-all duration-300 min-w-0 overflow-hidden">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 md:p-6 transition-all duration-300 overflow-y-auto overflow-x-hidden w-full">
            <div className="w-full max-w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
