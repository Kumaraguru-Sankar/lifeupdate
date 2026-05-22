import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, CheckCircle2, Flame, NotebookPen, BookOpen, Moon, Sun, LogOut, User, Target, Timer, Sparkles, Sun as SunIcon, Command, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useCommandPalette } from "@/components/command-palette";
import { useState } from "react";

const primaryNav = [
  { to: "/", label: "Today", icon: Home },
  { to: "/tasks", label: "Tasks", icon: CheckCircle2 },
  { to: "/habits", label: "Habits", icon: Flame },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/focus", label: "Focus", icon: Timer },
  { to: "/notes", label: "Notes", icon: NotebookPen },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/review", label: "Review", icon: SunIcon },
  { to: "/assistant", label: "Assistant", icon: Sparkles },
] as const;

const mobileNav = [
  { to: "/", label: "Today", icon: Home },
  { to: "/tasks", label: "Tasks", icon: CheckCircle2 },
  { to: "/focus", label: "Focus", icon: Timer },
  { to: "/assistant", label: "AI", icon: Sparkles },
  { to: "/profile", label: "Me", icon: User },
] as const;

export function AppShell({ title, subtitle, children, action, rightPanel, wide }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  rightPanel?: React.ReactNode;
  /** Allow main content to fill full width (no max-w cap). Defaults true when rightPanel is present. */
  wide?: boolean;
}) {
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { open: openPalette } = useCommandPalette();
  const [panelOpen, setPanelOpen] = useState(true);

  const signOut = async () => {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/login" });
  };

  const isWide = wide ?? !!rightPanel;
  const showRight = !!rightPanel && panelOpen;

  return (
    <div className="min-h-dvh bg-background text-foreground flex">
      {/* Sidebar (md+) */}
      <aside className="hidden md:flex w-[240px] lg:w-[260px] shrink-0 flex-col border-r border-border/60 bg-surface/60 px-4 py-7 sticky top-0 h-dvh">
        <Link to="/" className="flex items-center gap-2 mb-8 px-1">
          <span className="size-8 rounded-xl bg-foreground text-background grid place-items-center font-display text-lg">L</span>
          <span className="font-display text-2xl">LifeOS</span>
        </Link>

        <button
          onClick={openPalette}
          className="mb-6 flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          <span className="inline-flex items-center gap-2"><Command className="size-3.5" /> Quick command</span>
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-muted">⌘K</kbd>
        </button>

        <nav className="flex flex-col gap-0.5 overflow-y-auto -mx-1 px-1">
          {primaryNav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-all duration-300 ease-out-soft tap-scale",
                  active
                    ? "bg-foreground text-background shadow-soft"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn("size-4 transition-transform", active && "scale-105")} strokeWidth={active ? 2.2 : 1.7} />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-0.5 pt-6">
          <Link to="/profile" className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-colors", pathname === "/profile" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
            <User className="size-4" /> Profile
          </Link>
          <button onClick={toggle} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 glass-strong border-b border-border/40">
          <div className={cn(
            "px-5 md:px-8 xl:px-12 pt-6 md:pt-8 pb-4 md:pb-5 mx-auto w-full",
            isWide ? "max-w-[1600px]" : "max-w-3xl xl:max-w-4xl"
          )}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {subtitle && <p className="text-[10px] md:text-xs uppercase tracking-[0.22em] text-muted-foreground mb-2">{subtitle}</p>}
                <h1 className="font-display text-[2.25rem] md:text-5xl xl:text-6xl leading-[1.05] truncate">{title}</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={openPalette}
                  className="md:hidden grid place-items-center size-10 rounded-full bg-card border border-border/60 text-muted-foreground tap-scale"
                  aria-label="Command palette"
                >
                  <Command className="size-4" />
                </button>
                {rightPanel && (
                  <button
                    onClick={() => setPanelOpen(o => !o)}
                    className="hidden xl:grid place-items-center size-10 rounded-full bg-card border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Toggle insights panel"
                  >
                    {panelOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
                  </button>
                )}
                {action}
              </div>
            </div>
          </div>
        </header>

        <div className={cn(
          "flex-1 mx-auto w-full px-5 md:px-8 xl:px-12 py-6 md:py-8 pb-28 md:pb-12 fade-in-up",
          isWide ? "max-w-[1600px]" : "max-w-3xl xl:max-w-4xl"
        )}>
          {rightPanel ? (
            <div className={cn("grid gap-6 lg:gap-8", showRight ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1")}>
              <div className="min-w-0">{children}</div>
              {showRight && (
                <aside className="hidden xl:block">
                  <div className="sticky top-[148px] space-y-5 max-h-[calc(100dvh-180px)] overflow-y-auto pr-1 -mr-1">
                    {rightPanel}
                  </div>
                </aside>
              )}
            </div>
          ) : (
            children
          )}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 glass-strong border-t border-border/40 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around">
          {mobileNav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2.5 text-[10px] tap-scale flex-1 transition-colors",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("size-5 transition-transform duration-300 ease-out-soft", active && "scale-110")} strokeWidth={active ? 2.4 : 1.8} />
                <span className="tracking-wide">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
