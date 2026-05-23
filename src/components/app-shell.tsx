import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, CheckCircle2, Flame, NotebookPen, BookOpen, Moon, Sun, LogOut, User, Target, Timer, Sparkles, Sun as SunIcon, Command, PanelRightClose, PanelRightOpen, Heart, Wallet } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useCommandPalette } from "@/components/command-palette";
import { useState } from "react";

const primaryNav = [
  { to: "/", label: "Today", icon: Home, tint: "bg-grad-sky" },
  { to: "/tasks", label: "Missions", icon: CheckCircle2, tint: "bg-grad-mint" },
  { to: "/habits", label: "Habits", icon: Flame, tint: "bg-grad-peach" },
  { to: "/goals", label: "Goals", icon: Target, tint: "bg-grad-lilac" },
  { to: "/focus", label: "Focus", icon: Timer, tint: "bg-grad-mint" },
  { to: "/health", label: "Health", icon: Heart, tint: "bg-grad-peach" },
  { to: "/finance", label: "Finance", icon: Wallet, tint: "bg-grad-sun" },
  { to: "/notes", label: "Notes", icon: NotebookPen, tint: "bg-grad-sky" },
  { to: "/journal", label: "Journal", icon: BookOpen, tint: "bg-grad-lilac" },
  { to: "/review", label: "Review", icon: SunIcon, tint: "bg-grad-sun" },
  { to: "/assistant", label: "Assistant", icon: Sparkles, tint: "bg-grad-sky" },
] as const;

const mobileNav = [
  { to: "/", label: "Today", icon: Home },
  { to: "/health", label: "Health", icon: Heart },
  { to: "/habits", label: "Habits", icon: Flame },
  { to: "/assistant", label: "AI", icon: Sparkles },
  { to: "/profile", label: "Me", icon: User },
] as const;

export function AppShell({ title, subtitle, children, action, rightPanel, wide }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  rightPanel?: React.ReactNode;
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
    <div className="min-h-dvh text-foreground flex">
      {/* Sidebar (md+) */}
      <aside className="hidden md:flex w-[240px] lg:w-[260px] shrink-0 flex-col border-r border-border/40 bg-surface/40 backdrop-blur-xl px-4 py-7 sticky top-0 h-dvh">
        <Link to="/" className="flex items-center gap-2.5 mb-7 px-1">
          <span className="size-9 rounded-2xl bg-grad-sky grid place-items-center shadow-pop">
            <Sparkles className="size-4 text-white" strokeWidth={2.4} />
          </span>
          <span className="font-display text-2xl">LifeOS</span>
        </Link>

        <button
          onClick={openPalette}
          className="mb-5 flex items-center justify-between gap-2 rounded-2xl border border-border/50 bg-card/70 px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-all"
        >
          <span className="inline-flex items-center gap-2"><Command className="size-3.5" /> Quick command</span>
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-muted">⌘K</kbd>
        </button>

        <nav className="flex flex-col gap-1 overflow-y-auto -mx-1 px-1">
          {primaryNav.map(({ to, label, icon: Icon, tint }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] transition-all duration-300 ease-spring tap-scale",
                  active
                    ? "bg-card text-foreground shadow-soft border border-border/60"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                )}
              >
                <span className={cn(
                  "grid place-items-center size-7 rounded-xl text-white transition-all shadow-soft",
                  active ? tint : "bg-muted text-muted-foreground shadow-none"
                )}>
                  <Icon className="size-3.5" strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className="truncate font-medium">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-1 pt-6">
          <Link to="/profile" className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] transition-colors", pathname === "/profile" ? "bg-card border border-border/60 text-foreground shadow-soft" : "text-muted-foreground hover:bg-card/60 hover:text-foreground")}>
            <User className="size-4" /> Profile
          </Link>
          <button onClick={toggle} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] text-muted-foreground hover:bg-card/60 hover:text-foreground transition-colors">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] text-muted-foreground hover:bg-card/60 hover:text-foreground transition-colors">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 glass-strong border-b border-border/30">
          <div className={cn(
            "px-5 md:px-8 xl:px-12 pt-6 md:pt-8 pb-4 md:pb-5 mx-auto w-full",
            isWide ? "max-w-[1600px]" : "max-w-3xl xl:max-w-4xl"
          )}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {subtitle && <p className="text-[10px] md:text-xs uppercase tracking-[0.22em] text-muted-foreground mb-2 font-medium">{subtitle}</p>}
                <h1 className="font-display text-[2rem] md:text-5xl xl:text-6xl leading-[1.05] truncate">{title}</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={openPalette}
                  className="md:hidden grid place-items-center size-10 rounded-2xl bg-card border border-border/60 text-muted-foreground tap-scale shadow-soft"
                  aria-label="Command palette"
                >
                  <Command className="size-4" />
                </button>
                {rightPanel && (
                  <button
                    onClick={() => setPanelOpen(o => !o)}
                    className="hidden xl:grid place-items-center size-10 rounded-2xl bg-card border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
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

      {/* Mobile bottom nav — cozy floating pill */}
      <nav className="md:hidden fixed bottom-3 inset-x-3 z-30 rounded-3xl glass-strong border border-border/40 shadow-lift pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around p-1.5">
          {mobileNav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-2xl text-[10px] tap-scale flex-1 transition-all ease-spring",
                  active ? "bg-grad-sky text-white shadow-soft" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("size-5 transition-transform duration-300", active && "scale-110")} strokeWidth={active ? 2.4 : 1.9} />
                <span className="tracking-wide font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
