import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, FileText, FileSpreadsheet, Box, Settings, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";

/* WEB-TO-DESKTOP NOTE: For Electron, the window chrome (title bar, close/min/max) replaces the web header.
   Add `electron-specific-titlebar` or custom drag region here for desktop build. */

const navItems = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/devis", label: "Devis", icon: FileText },
  { href: "/factures", label: "Factures", icon: FileSpreadsheet },
  { href: "/catalogue", label: "Catalogue", icon: Box },
  { href: "/parametres", label: "Paramètres", icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen bg-background text-foreground print:block">
      <aside className="w-64 glass-panel border-r border-border flex flex-col hidden md:flex print:hidden">
        <div className="h-16 flex items-center justify-between px-6 border-b border-border bg-card/50">
          <span className="text-xl font-bold text-primary tracking-tight">EncadrePro</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
            onClick={toggleTheme}
            title={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(124,107,255,0.1)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}>
                <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "opacity-70")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground/50 text-center">EncadrePro v2.0</p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-background/95 print:bg-white">
        <div className="flex-1 overflow-auto p-8 print:p-0">
          <div className="max-w-7xl mx-auto print:max-w-none">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
