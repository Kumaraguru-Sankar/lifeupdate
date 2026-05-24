import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Plus, Target, Trash2, Pencil } from "lucide-react";
import { SortableList } from "@/components/sortable-list";
import { toast } from "sonner";

type Goal = {
  id: string; title: string; description: string | null;
  target_date: string | null; progress: number; completed: boolean;
  sort_order: number;
};

export const Route = createFileRoute("/_authenticated/goals")({ component: Goals });

function Goals() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [date, setDate] = useState("");

  const { data: goals = [] } = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals").select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Goal[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const nextOrder = (goals[goals.length - 1]?.sort_order ?? 0) + 1;
      const { error } = await supabase.from("goals").insert({
        user_id: user.id, title: draft.trim(), target_date: date || null, sort_order: nextOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); setDraft(""); setDate(""); },
  });

  const setProgress = useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const { error } = await supabase.from("goals").update({ progress, completed: progress >= 100 }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      if (v.progress >= 100) toast.success("🎉 Goal complete! Big move.");
    },
  });

  const editGoal = useMutation({
    mutationFn: async ({ id, title, target_date }: { id: string; title?: string; target_date?: string | null }) => {
      const patch: any = {};
      if (title !== undefined) patch.title = title;
      if (target_date !== undefined) patch.target_date = target_date;
      const { error } = await supabase.from("goals").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); toast.success("Goal updated"); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await supabase.from("goals").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  const reorder = useMutation({
    mutationFn: async (next: Goal[]) => {
      await Promise.all(next.map((g, i) => supabase.from("goals").update({ sort_order: i }).eq("id", g.id)));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  return (
    <AppShell title="Goals" subtitle="Drag to reorder · what you're growing toward">
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
        <SortableList
          items={goals}
          onReorder={next => reorder.mutate(next)}
          className="space-y-3"
          renderItem={(g, handle) => (
            <div className="rounded-2xl bg-card border border-border/60 p-5 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="pt-1">{handle}</div>
                  <div className="min-w-0">
                    <p className="font-display text-xl leading-tight">{g.title}</p>
                    {g.target_date && <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">by {new Date(g.target_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const t = prompt("Edit goal title", g.title);
                      if (t === null) return;
                      const d = prompt("Target date (YYYY-MM-DD, blank for none)", g.target_date ?? "");
                      if (d === null) return;
                      editGoal.mutate({ id: g.id, title: t.trim() || g.title, target_date: d.trim() || null });
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  ><Pencil className="size-4" /></button>
                  <button
                    onClick={() => { if (confirm("Delete this goal?")) remove.mutate(g.id); }}
                    className="text-muted-foreground hover:text-destructive"
                  ><Trash2 className="size-4" /></button>
                </div>
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
            </div>
          )}
        />
      )}
    </AppShell>
  );
}
