import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Plus, Target, Trash2, Pencil, ChevronDown, ChevronRight, Calendar, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useBadgeSyncer } from "@/lib/badges";
import { PeriodPicker } from "@/components/period-picker";
import { usePeriod } from "@/hooks/use-period";
import { GoalsAnalytics } from "@/components/goals-analytics";

type Goal = {
  id: string; title: string; description: string | null;
  target_date: string | null; progress: number; completed: boolean;
  sort_order: number;
};

type Task = {
  id: string; title: string; completed: boolean;
  due_date: string | null; goal_id: string | null; sort_order: number;
};

export const Route = createFileRoute("/_authenticated/goals")({ component: Goals });

function Goals() {
  const qc = useQueryClient();
  const syncBadges = useBadgeSyncer();
  const [draft, setDraft] = useState("");
  const [date, setDate] = useState("");
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [period, setPeriod] = usePeriod("goals");

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

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks_for_goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,completed,due_date,goal_id,sort_order")
        .not("goal_id", "is", null)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Task[];
    },
  });

  const addGoal = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const nextOrder = (goals[goals.length - 1]?.sort_order ?? 0) + 1;
      const { data, error } = await supabase.from("goals").insert({
        user_id: user.id, title: draft.trim(), target_date: date || null, sort_order: nextOrder,
      }).select().single();
      if (error) throw error;
      return data as Goal;
    },
    onSuccess: (g) => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      setDraft(""); setDate("");
      setOpenIds(prev => ({ ...prev, [g.id]: true }));
    },
  });

  const editGoal = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Goal> }) => {
      const { error } = await supabase.from("goals").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); toast.success("Goal updated"); },
  });

  const removeGoal = useMutation({
    mutationFn: async (id: string) => { await supabase.from("goals").delete().eq("id", id); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["tasks_for_goals"] });
    },
  });

  // Auto-recalculate goal progress from tasks
  const refreshProgress = async (goalId: string) => {
    const goalTasks = tasks.filter(t => t.goal_id === goalId);
    // Include just-mutated task by refetching
    const { data } = await supabase.from("tasks").select("completed").eq("goal_id", goalId);
    const all = data ?? [];
    const total = all.length;
    const done = all.filter(t => t.completed).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    await supabase.from("goals").update({ progress: pct, completed: pct >= 100 && total > 0 }).eq("id", goalId);
    if (pct >= 100 && total > 0) toast.success("🎉 Goal complete! Big move.");
    qc.invalidateQueries({ queryKey: ["goals"] });
    void goalTasks;
  };

  const addTask = useMutation({
    mutationFn: async ({ goalId, title }: { goalId: string; title: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const goalTasks = tasks.filter(t => t.goal_id === goalId);
      const nextOrder = (goalTasks[goalTasks.length - 1]?.sort_order ?? 0) + 1;
      const { error } = await supabase.from("tasks").insert({
        user_id: user.id, title: title.trim(), goal_id: goalId, sort_order: nextOrder,
      });
      if (error) throw error;
      return goalId;
    },
    onSuccess: async (goalId) => {
      qc.invalidateQueries({ queryKey: ["tasks_for_goals"] });
      await refreshProgress(goalId);
    },
  });

  const toggleTask = useMutation({
    mutationFn: async (t: Task) => {
      const { error } = await supabase.from("tasks").update({ completed: !t.completed }).eq("id", t.id);
      if (error) throw error;
      return t.goal_id!;
    },
    onSuccess: async (goalId) => {
      qc.invalidateQueries({ queryKey: ["tasks_for_goals"] });
      qc.invalidateQueries({ queryKey: ["xp"] });
      qc.invalidateQueries({ queryKey: ["game_stats"] });
      await refreshProgress(goalId);
      await syncBadges();
    },
  });

  const editTask = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase.from("tasks").update({ title }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks_for_goals"] }),
  });

  const removeTask = useMutation({
    mutationFn: async (t: Task) => {
      const { error } = await supabase.from("tasks").delete().eq("id", t.id);
      if (error) throw error;
      return t.goal_id!;
    },
    onSuccess: async (goalId) => {
      qc.invalidateQueries({ queryKey: ["tasks_for_goals"] });
      await refreshProgress(goalId);
    },
  });

  return (
    <AppShell title="Goals" subtitle="What you're building toward">
      <div className="mb-4"><PeriodPicker value={period} onChange={setPeriod} /></div>
      <div className="mb-6"><GoalsAnalytics period={period} /></div>
      <form
        onSubmit={e => { e.preventDefault(); if (draft.trim()) addGoal.mutate(); }}
        className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] p-3 mb-6 nb-shadow"
      >
        <div className="flex items-center gap-2">
          <button type="submit" className="grid place-items-center size-10 rounded-xl bg-[var(--nb-orange)] text-[var(--nb-ink)] border-[2.5px] border-[var(--nb-ink)] nb-shadow tap-scale">
            <Plus className="size-4" strokeWidth={3} />
          </button>
          <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Name a goal worth pursuing…" className="flex-1 bg-transparent outline-none text-[15px] font-semibold placeholder:text-muted-foreground" />
        </div>
        <div className="mt-2 flex items-center gap-2 px-1">
          <Calendar className="size-3.5 text-muted-foreground" />
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-1 bg-transparent text-xs text-muted-foreground outline-none" />
        </div>
      </form>

      {goals.length === 0 ? (
        <div className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] p-8 text-center nb-shadow">
          <Target className="size-6 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Name one meaningful goal. Big or small — what matters is choosing.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map(g => {
            const goalTasks = tasks.filter(t => t.goal_id === g.id);
            const done = goalTasks.filter(t => t.completed).length;
            const total = goalTasks.length;
            const pct = total === 0 ? g.progress : Math.round((done / total) * 100);
            const isOpen = openIds[g.id] ?? false;
            const overdue = g.target_date && new Date(g.target_date) < new Date() && pct < 100;
            return (
              <div key={g.id} className={cn(
                "rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow overflow-hidden",
                pct >= 100 && "bg-[var(--nb-green)]/10"
              )}>
                <button
                  onClick={() => setOpenIds(prev => ({ ...prev, [g.id]: !prev[g.id] }))}
                  className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <span className="mt-1">
                    {isOpen ? <ChevronDown className="size-4" strokeWidth={3} /> : <ChevronRight className="size-4" strokeWidth={3} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-display text-xl leading-tight", pct >= 100 && "line-through opacity-60")}>{g.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider">
                      {g.target_date && (
                        <span className={cn("inline-flex items-center gap-1 font-bold", overdue ? "text-[var(--nb-pink)]" : "text-muted-foreground")}>
                          <Calendar className="size-3" />
                          {new Date(g.target_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                      <span className="text-muted-foreground font-bold">{done}/{total} tasks</span>
                      {pct >= 100 && total > 0 && <span className="px-2 py-0.5 rounded-full bg-[var(--nb-green)] text-[var(--nb-ink)] font-black">✓ Done</span>}
                    </div>
                    <div className="mt-3 h-2.5 w-full rounded-full bg-muted overflow-hidden border-[1.5px] border-[var(--nb-ink)]">
                      <div className="h-full bg-[var(--nb-orange)] transition-[width] duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const t = prompt("Edit goal title", g.title);
                        if (t === null) return;
                        const d = prompt("Target date (YYYY-MM-DD, blank for none)", g.target_date ?? "");
                        if (d === null) return;
                        editGoal.mutate({ id: g.id, patch: { title: t.trim() || g.title, target_date: d.trim() || null } });
                      }}
                      className="grid place-items-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                      aria-label="Edit goal"
                    ><Pencil className="size-4" /></button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Delete this goal and its tasks?")) removeGoal.mutate(g.id);
                      }}
                      className="grid place-items-center size-8 rounded-lg text-muted-foreground hover:text-[var(--nb-pink)] hover:bg-muted"
                      aria-label="Delete goal"
                    ><Trash2 className="size-4" /></button>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t-[2.5px] border-[var(--nb-ink)] bg-muted/20 p-3 space-y-2">
                    {goalTasks.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2 py-1">No tasks yet — break this goal into steps below.</p>
                    )}
                    {goalTasks.map(t => (
                      <div key={t.id} className="group flex items-center gap-2 px-2 py-2 rounded-xl bg-card border-[2px] border-[var(--nb-ink)]/30 hover:border-[var(--nb-ink)] transition-colors">
                        <button
                          onClick={() => toggleTask.mutate(t)}
                          className={cn(
                            "size-6 rounded-md border-[2.5px] border-[var(--nb-ink)] grid place-items-center transition-all tap-scale",
                            t.completed ? "bg-[var(--nb-green)]" : "bg-white"
                          )}
                          aria-label="Toggle task"
                        >
                          {t.completed && <CheckCircle2 className="size-4 text-[var(--nb-ink)]" strokeWidth={3} />}
                        </button>
                        <span className={cn("flex-1 text-sm", t.completed && "line-through text-muted-foreground")}>{t.title}</span>
                        <button
                          onClick={() => {
                            const next = prompt("Edit task", t.title);
                            if (next && next.trim() && next !== t.title) editTask.mutate({ id: t.id, title: next.trim() });
                          }}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                          aria-label="Edit task"
                        ><Pencil className="size-3.5" /></button>
                        <button
                          onClick={() => { if (confirm("Delete this task?")) removeTask.mutate(t); }}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[var(--nb-pink)] transition-opacity"
                          aria-label="Delete task"
                        ><Trash2 className="size-3.5" /></button>
                      </div>
                    ))}
                    <AddTaskRow onAdd={(title) => addTask.mutate({ goalId: g.id, title })} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function AddTaskRow({ onAdd }: { onAdd: (title: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <form
      onSubmit={e => { e.preventDefault(); if (val.trim()) { onAdd(val.trim()); setVal(""); } }}
      className="flex items-center gap-2 px-2 py-1.5"
    >
      <button type="submit" className="grid place-items-center size-7 rounded-md bg-[var(--nb-yellow)] border-[2px] border-[var(--nb-ink)] tap-scale" aria-label="Add task">
        <Plus className="size-3.5" strokeWidth={3} />
      </button>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder="Add a step…"
        className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
      />
    </form>
  );
}
