import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useState } from "react";
import { Plus, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

type Habit = { id: string; name: string; days: string[] };

export const Route = createFileRoute("/habits")({ component: Habits });

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

function Habits() {
  const [habits, setHabits] = useLocalStorage<Habit[]>("lifeos.habits", []);
  const [draft, setDraft] = useState("");

  const last7 = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    setHabits([...habits, { id: crypto.randomUUID(), name, days: [] }]);
    setDraft("");
  };

  const toggle = (id: string, key: string) =>
    setHabits(habits.map(h => h.id === id
      ? { ...h, days: h.days.includes(key) ? h.days.filter(k => k !== key) : [...h.days, key] }
      : h
    ));

  return (
    <AppShell title="Habits" subtitle="Tend the small things daily">
      <form
        onSubmit={e => { e.preventDefault(); add(); }}
        className="flex items-center gap-2 rounded-2xl bg-card border border-border/60 px-3 py-2 mb-6 focus-within:border-accent/60 transition-colors"
      >
        <button type="submit" className="grid place-items-center size-9 rounded-xl bg-accent text-accent-foreground">
          <Plus className="size-4" />
        </button>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Add a habit (e.g. read 20 min)"
          className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-muted-foreground"
        />
      </form>

      {habits.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border/60 p-8 text-center">
          <Flame className="size-6 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Pick one habit to start. Consistency beats intensity.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {habits.map(h => (
            <li key={h.id} className="rounded-2xl bg-card border border-border/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium">{h.name}</span>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Flame className="size-3" /> {h.days.length}
                </span>
              </div>
              <div className="flex gap-1.5">
                {last7.map(d => {
                  const k = dayKey(d);
                  const active = h.days.includes(k);
                  return (
                    <button
                      key={k}
                      onClick={() => toggle(h.id, k)}
                      className={cn(
                        "flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-colors",
                        active ? "bg-accent text-accent-foreground" : "bg-muted/50 hover:bg-muted text-muted-foreground"
                      )}
                    >
                      <span className="text-[10px] uppercase tracking-wider">{d.toLocaleDateString(undefined, { weekday: "short" })[0]}</span>
                      <span className="text-xs font-medium">{d.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
