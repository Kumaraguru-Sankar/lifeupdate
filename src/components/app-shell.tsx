import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, Target, NotebookPen, Moon, Sun, LogOut, User, Sparkles, Heart, Wallet, BarChart3 } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

// Seven-tab navigation (Assistant replaced by Reports)
const tabs = [
  { to: "/",        label: "Home",    icon: Home,        tint: "bg-[var(--nb-yellow)] text-[var(--nb-ink)]" },
  { to: "/health",  label: "Health",  icon: Heart,       tint: "bg-[var(--nb-green)] text-[var(--nb-ink)]" },
  { to: "/finance", label: "Finance", icon: Wallet,      tint: "bg-[var(--nb-yellow)] text-[var(--nb-ink)]" },
  { to: "/goals",   label: "Goals",   icon: Target,      tint: "bg-[var(--nb-orange)] text-[var(--nb-ink)]" },
  { to: "/notes",   label: "Notes",   icon: NotebookPen, tint: "bg-[var(--nb-blue)] text-white" },
  { to: "/reports", label: "Reports", icon: BarChart3,   tint: "bg-[var(--nb-pink)] text-white" },
  { to: "/profile", label: "Profile", icon: User,        tint: "bg-[var(--nb-ink)] text-white" },
] as const;

export function AppShell({ title, subtitle, children, action }: {
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

  const signOut = async () => {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-dvh text-foreground flex">
      {/* Desktop sidebar — same 6 tabs for parity */}
      <aside className="hidden md:flex w-[248px] lg:w-[268px] shrink-0 flex-col border-r-[3px] border-[var(--nb-ink)] bg-[var(--nb-yellow)] px-4 py-7 sticky top-0 h-dvh">
        <Link to="/" className="flex items-center gap-2.5 mb-7 px-1">
          <span className="size-10 rounded-xl bg-[var(--nb-ink)] grid place-items-center nb-shadow border-[3px] border-[var(--nb-ink)]">
            <Sparkles className="size-5 text-[var(--nb-yellow)]" strokeWidth={2.8} />
          </span>
          <span className="font-display text-2xl tracking-tight">LifeUpdate</span>
        </Link>

        <nav className="flex flex-col gap-1.5 overflow-y-auto -mx-1 px-1">
          {tabs.map(({ to, label, icon: Icon, tint }) => {
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
          <div className="px-5 md:px-8 xl:px-12 pt-6 md:pt-8 pb-4 md:pb-5 mx-auto w-full max-w-3xl xl:max-w-4xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex items-center gap-3">
                <Link to="/" className="md:hidden size-10 shrink-0 rounded-xl bg-[var(--nb-ink)] grid place-items-center nb-shadow border-[3px] border-[var(--nb-ink)]">
                  <Sparkles className="size-5 text-[var(--nb-yellow)]" strokeWidth={2.8} />
                </Link>
                <div className="min-w-0">
                  {subtitle && <p className="inline-block nb-pill mb-2 bg-[var(--nb-yellow)]">{subtitle}</p>}
                  <h1 className="font-display text-[1.9rem] md:text-5xl xl:text-6xl leading-[1.02] truncate">{title}</h1>
                </div>
              </div>
              {action && <div className="flex items-center gap-2">{action}</div>}
            </div>
          </div>
        </header>

        <div className="flex-1 mx-auto w-full px-5 md:px-8 xl:px-12 py-6 md:py-8 pb-32 md:pb-12 max-w-3xl xl:max-w-4xl fade-in-up">
          {children}
        </div>
      </main>

      {/* Bottom navigation — mobile only */}
      <BottomNav pathname={pathname} />
    </div>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed left-3 right-3 bottom-3 z-30 rounded-2xl bg-white border-[3px] border-[var(--nb-ink)] nb-shadow-lg p-1.5"
      style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
    >
      <div className="grid grid-cols-7 gap-0.5">
        {tabs.map(({ to, label, icon: Icon, tint }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 border-[2.5px] tap-scale transition-all min-h-[52px]",
                active
                  ? `${tint} border-[var(--nb-ink)] nb-shadow`
                  : "border-transparent text-[var(--nb-ink)] hover:bg-[var(--nb-yellow)]/40"
              )}
            >
              <Icon className={cn("size-[18px] transition-transform", active && "scale-110")} strokeWidth={active ? 2.8 : 2.3} />
              <span className={cn("text-[10px] font-bold leading-none", !active && "opacity-70")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
