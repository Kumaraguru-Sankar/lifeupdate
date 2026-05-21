import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";

type Goal = { id: string; title: string; description: string | null; target_date: string | null; progress: number; completed: boolean };

export const Route = createFileRoute("/_authenticated/goals")({ component: Goals });

function Goals() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [date, setDate] = useState("");

  const { data: goals = [] } = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Goal[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("goals").insert({ user_id: user.id, title: draft.trim(), target_date: date || null });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); setDraft(""); setDate(""); },
  });

  const setProgress = useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const { error } = await supabase.from("goals").update({ progress, completed: progress >= 100 }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await supabase.from("goals").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  return (
    <AppShell title="Goals" subtitle="What you're growing toward">
      <form
        onSubmit={e => { e.preventDefault(); if (draft.trim()) add.mutate(); }}
        className="rounded-2xl bg-card border border-border/60 p-3 mb-6 shadow-soft"
      >
        <div className="flex items-center gap-2">
          <button type="submit" className="grid place-items-center size-9 rounded-xl bg-accent text-accent-foreground tap-scale"><Plus className="size-4" /></button>
          <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="A goal worth pursuing…" className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-muted-foreground" />
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-2 w-full bg-transparent text-xs text-muted-foreground outline-none px-1" />
      </form>

      {goals.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border/60 p-8 text-center">
          <Target className="size-6 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Name one meaningful goal. Big or small — what matters is choosing.</p>
        </div>
      ) : (
        <ul className="space-y-3 stagger">
          {goals.map(g => (
            <li key={g.id} className="rounded-2xl bg-card border border-border/60 p-5 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-xl leading-tight">{g.title}</p>
                  {g.target_date && <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">by {new Date(g.target_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>}
                </div>
                <button onClick={() => remove.mutate(g.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="size-4" /></button>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground">Progress</span>
                  <span className="font-display text-lg">{g.progress}<span className="text-xs text-muted-foreground">%</span></span>
                </div>
                <input
                  type="range" min={0} max={100} step={5} value={g.progress}
                  onChange={e => setProgress.mutate({ id: g.id, progress: Number(e.target.value) })}
                  className="w-full accent-accent"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
