import { Link, useLocation } from "@tanstack/react-router";
import { Home, CheckCircle2, Flame, NotebookPen, BookOpen, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Today", icon: Home },
  { to: "/tasks", label: "Tasks", icon: CheckCircle2 },
  { to: "/habits", label: "Habits", icon: Flame },
  { to: "/notes", label: "Notes", icon: NotebookPen },
  { to: "/journal", label: "Journal", icon: BookOpen },
] as const;

export function AppShell({ title, subtitle, children, action }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-dvh bg-background text-foreground flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/60 bg-surface px-5 py-8">
        <Link to="/" className="flex items-center gap-2 mb-10">
          <span className="size-8 rounded-xl bg-foreground text-background grid place-items-center font-display text-lg">L</span>
          <span className="font-display text-2xl">LifeOS</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4" /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          <button onClick={toggle} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="px-5 md:px-10 pt-7 pb-5 max-w-3xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                {subtitle && <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">{subtitle}</p>}
                <h1 className="font-display text-4xl md:text-5xl leading-none">{title}</h1>
              </div>
              {action}
            </div>
          </div>
        </header>
        <div className="flex-1 px-5 md:px-10 py-6 max-w-3xl w-full pb-28 md:pb-10">
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/60 bg-background/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2.5 text-[10px] transition-colors flex-1",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("size-5 transition-transform", active && "scale-110")} strokeWidth={active ? 2.4 : 1.8} />
                <span className="tracking-wide">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
