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
      <aside className="hidden md:flex w-[248px] lg:w-[268px] shrink-0 flex-col border-r-[3px] border-[var(--nb-ink)] bg-[var(--nb-yellow)] px-4 py-7 sticky top-0 h-dvh">
        <Link to="/" className="flex items-center gap-2.5 mb-7 px-1">
          <span className="size-10 rounded-xl bg-[var(--nb-ink)] grid place-items-center nb-shadow border-[3px] border-[var(--nb-ink)]">
            <Sparkles className="size-5 text-[var(--nb-yellow)]" strokeWidth={2.8} />
          </span>
          <span className="font-display text-2xl tracking-tight">LifeUpdate</span>
        </Link>

        <button
          onClick={openPalette}
          className="mb-5 flex items-center justify-between gap-2 rounded-xl border-[3px] border-[var(--nb-ink)] bg-white px-3 py-2.5 text-xs font-bold text-[var(--nb-ink)] nb-shadow tap-scale"
        >
          <span className="inline-flex items-center gap-2"><Command className="size-3.5" /> Quick command</span>
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--nb-ink)] text-white font-mono">⌘K</kbd>
        </button>

        <nav className="flex flex-col gap-2 overflow-y-auto -mx-1 px-1">
          {primaryNav.map(({ to, label, icon: Icon, tint }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold transition-all tap-scale border-[3px]",
                  active
                    ? "bg-white text-[var(--nb-ink)] border-[var(--nb-ink)] nb-shadow"
                    : "bg-transparent border-transparent text-[var(--nb-ink)] hover:bg-white/60 hover:border-[var(--nb-ink)]"
                )}
              >
                <span className={cn(
                  "grid place-items-center size-8 rounded-lg border-[2.5px] border-[var(--nb-ink)] transition-all",
                  active ? tint : "bg-white"
                )}>
                  <Icon className="size-4" strokeWidth={2.6} />
                </span>
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2 pt-6">
          <Link to="/profile" className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold transition-all border-[3px]", pathname === "/profile" ? "bg-white border-[var(--nb-ink)] nb-shadow text-[var(--nb-ink)]" : "border-transparent text-[var(--nb-ink)] hover:bg-white/60 hover:border-[var(--nb-ink)]")}>
            <User className="size-4" /> Profile
          </Link>
          <button onClick={toggle} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold text-[var(--nb-ink)] border-[3px] border-transparent hover:bg-white/60 hover:border-[var(--nb-ink)] transition-all">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold text-[var(--nb-ink)] border-[3px] border-transparent hover:bg-white/60 hover:border-[var(--nb-ink)] transition-all">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-[var(--background)] border-b-[3px] border-[var(--nb-ink)]">
          <div className={cn(
            "px-5 md:px-8 xl:px-12 pt-6 md:pt-8 pb-4 md:pb-5 mx-auto w-full",
            isWide ? "max-w-[1600px]" : "max-w-3xl xl:max-w-4xl"
          )}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {subtitle && <p className="inline-block nb-pill mb-3 bg-[var(--nb-yellow)]">{subtitle}</p>}
                <h1 className="font-display text-[2.25rem] md:text-5xl xl:text-6xl leading-[1.02] truncate">{title}</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={openPalette}
                  className="md:hidden grid place-items-center size-11 rounded-xl bg-white border-[3px] border-[var(--nb-ink)] text-[var(--nb-ink)] tap-scale nb-shadow"
                  aria-label="Command palette"
                >
                  <Command className="size-4" strokeWidth={2.6} />
                </button>
                {rightPanel && (
                  <button
                    onClick={() => setPanelOpen(o => !o)}
                    className="hidden xl:grid place-items-center size-11 rounded-xl bg-white border-[3px] border-[var(--nb-ink)] text-[var(--nb-ink)] nb-shadow tap-scale"
                    aria-label="Toggle insights panel"
                  >
                    {panelOpen ? <PanelRightClose className="size-4" strokeWidth={2.6} /> : <PanelRightOpen className="size-4" strokeWidth={2.6} />}
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

      {/* Mobile bottom nav — chunky brutalist bar */}
      <nav className="md:hidden fixed bottom-3 inset-x-3 z-30 rounded-2xl bg-white border-[3px] border-[var(--nb-ink)] nb-shadow-lg pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around p-1.5">
          {mobileNav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            const tints = ["bg-[var(--nb-yellow)]", "bg-[var(--nb-green)]", "bg-[var(--nb-blue)] text-white", "bg-[var(--nb-pink)] text-white", "bg-[var(--nb-orange)]"];
            const tint = tints[mobileNav.findIndex(n => n.to === to)] ?? "bg-[var(--nb-yellow)]";
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-xl text-[10px] font-extrabold tap-scale flex-1 transition-all border-[2.5px]",
                  active ? `${tint} border-[var(--nb-ink)] nb-shadow` : "border-transparent text-[var(--nb-ink)]"
                )}
              >
                <Icon className={cn("size-5 transition-transform", active && "scale-110")} strokeWidth={active ? 2.8 : 2.2} />
                <span className="tracking-wide">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

