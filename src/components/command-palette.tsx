import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Home, Flame, NotebookPen, Target, Timer, Sparkles, User, Sun as SunIcon, Moon, Sun, Search, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type Ctx = { open: () => void; close: () => void; isOpen: boolean };
const CommandCtx = createContext<Ctx | null>(null);

export function useCommandPalette() {
  const c = useContext(CommandCtx);
  if (!c) return { open: () => {}, close: () => {}, isOpen: false };
  return c;
}

type Item = { id: string; label: string; hint?: string; icon: React.ComponentType<{ className?: string }>; run: () => void; group: string };

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const qc = useQueryClient();

  const close = useCallback(() => { setOpen(false); setQ(""); }, []);
  const open = useCallback(() => setOpen(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(v => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items: Item[] = useMemo(() => [
    { id: "today", label: "Go to Home", group: "Navigate", icon: Home, run: () => navigate({ to: "/" }) },
    { id: "habits", label: "Go to Habits", group: "Navigate", icon: Flame, run: () => navigate({ to: "/habits" }) },
    { id: "goals", label: "Go to Goals & Tasks", group: "Navigate", icon: Target, run: () => navigate({ to: "/goals" }) },
    { id: "focus", label: "Start Focus Session", group: "Navigate", icon: Timer, run: () => navigate({ to: "/focus" }) },
    { id: "notes", label: "Go to Notes & Journal", group: "Navigate", icon: NotebookPen, run: () => navigate({ to: "/notes" }) },
    { id: "review", label: "Open Daily Review", group: "Navigate", icon: SunIcon, run: () => navigate({ to: "/review" }) },
    { id: "assistant", label: "Ask the Assistant", group: "Navigate", icon: Sparkles, run: () => navigate({ to: "/assistant" }) },
    { id: "profile", label: "Profile & Settings", group: "Navigate", icon: User, run: () => navigate({ to: "/profile" }) },
    { id: "theme", label: theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode", group: "Actions", icon: theme === "dark" ? Sun : Moon, run: toggle },
    { id: "signout", label: "Sign out", group: "Actions", icon: LogOut, run: async () => { await supabase.auth.signOut(); qc.clear(); navigate({ to: "/login" }); } },
  ], [navigate, theme, toggle, qc]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(i => i.label.toLowerCase().includes(s) || i.group.toLowerCase().includes(s));
  }, [items, q]);

  const [active, setActive] = useState(0);
  useEffect(() => { setActive(0); }, [q, isOpen]);

  const onKeyInput = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(filtered.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); filtered[active]?.run(); close(); }
  };

  return (
    <CommandCtx.Provider value={{ open, close, isOpen }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-[60] fade-in" onClick={close}>
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" />
          <div
            className="absolute left-1/2 top-[18%] -translate-x-1/2 w-[92vw] max-w-xl rounded-2xl glass-strong border border-border/60 shadow-lift overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
              <Search className="size-4 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={onKeyInput}
                placeholder="Search commands…"
                className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-muted-foreground"
              />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">esc</kbd>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No matches.</p>
              ) : (
                filtered.map((it, i) => {
                  const Icon = it.icon;
                  return (
                    <button
                      key={it.id}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => { it.run(); close(); }}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-left transition-colors",
                        i === active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{it.label}</span>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{it.group}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </CommandCtx.Provider>
  );
}
