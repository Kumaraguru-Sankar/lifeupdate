import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Plus, Flame, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { HabitAnalytics } from "@/components/habit-analytics";

type Habit = { id: string; name: string };

export const Route = createFileRoute("/_authenticated/habits")({ component: Habits });

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

function Habits() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const last7 = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const since = dayKey(last7[0]);

  const { data: habits = [] } = useQuery({
    queryKey: ["habits"],
    queryFn: async () => {
      const { data, error } = await supabase.from("habits").select("id,name").order("created_at");
      if (error) throw error;
      return data as Habit[];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["habit_logs", since],
    queryFn: async () => {
      const { data, error } = await supabase.from("habit_logs").select("habit_id,date").gte("date", since);
      if (error) throw error;
      return data as { habit_id: string; date: string }[];
    },
  });

  const add = useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("habits").insert({ name, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits"] }),
  });

  const toggle = useMutation({
    mutationFn: async ({ habitId, date, exists }: { habitId: string; date: string; exists: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      if (exists) {
        const { error } = await supabase.from("habit_logs").delete().eq("habit_id", habitId).eq("date", date);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("habit_logs").insert({ habit_id: habitId, date, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habit_logs"] });
      qc.invalidateQueries({ queryKey: ["xp"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Remove logs first (no FK cascade) then habit
      await supabase.from("habit_logs").delete().eq("habit_id", id);
      const { error } = await supabase.from("habits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["habit_logs"] });
      toast.success("Habit removed");
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete habit"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    add.mutate(name);
    setDraft("");
  };

  const isDone = (habitId: string, date: string) => logs.some(l => l.habit_id === habitId && l.date === date);

  return (
    <AppShell title="Habits" subtitle="Tend the small things daily">
      <HabitAnalytics />

      <form
        onSubmit={submit}
        className="flex items-center gap-2 rounded-2xl bg-card border border-border/60 px-3 py-2 mb-6 focus-within:border-accent/60 transition-colors shadow-soft"
      >
        <button type="submit" className="grid place-items-center size-9 rounded-xl bg-accent text-accent-foreground tap-scale">
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
        <ul className="space-y-3 stagger">
          {habits.map(h => {
            const streak = last7.filter(d => isDone(h.id, dayKey(d))).length;
            return (
              <li key={h.id} className="group rounded-2xl bg-card border border-border/60 p-4 shadow-soft">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">{h.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Flame className="size-3" /> {streak}/7
                    </span>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${h.name}"? This also removes its check-in history.`)) remove.mutate(h.id);
                      }}
                      className="text-muted-foreground hover:text-destructive transition-colors opacity-60 hover:opacity-100"
                      aria-label="Delete habit"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {last7.map(d => {
                    const k = dayKey(d);
                    const active = isDone(h.id, k);
                    return (
                      <button
                        key={k}
                        onClick={() => toggle.mutate({ habitId: h.id, date: k, exists: active })}
                        className={cn(
                          "flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-all duration-300 ease-out-soft tap-scale",
                          active ? "bg-accent text-accent-foreground scale-[1.02]" : "bg-muted/50 hover:bg-muted text-muted-foreground"
                        )}
                      >
                        <span className="text-[10px] uppercase tracking-wider">{d.toLocaleDateString(undefined, { weekday: "short" })[0]}</span>
                        <span className="text-xs font-medium">{d.getDate()}</span>
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
