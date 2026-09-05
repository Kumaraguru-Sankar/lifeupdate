import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import {
  Plus, Target, Trash2, Pencil, ChevronDown, ChevronRight, Calendar, CheckCircle2,
  Flame, ListChecks, Archive, Repeat, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useBadgeSyncer } from "@/lib/badges";
import { PeriodPicker } from "@/components/period-picker";
import { usePeriod } from "@/hooks/use-period";
import { GoalsAnalytics } from "@/components/goals-analytics";
import { SortableList } from "@/components/sortable-list";
import { HabitEditor, type HabitDraft } from "@/components/habit-editor";
import { isoDay, isScheduled, scheduledDates, streaks, frequencyLabel, type HabitRow } from "@/lib/habit-schedule";
import { safeErrorMessage } from "@/lib/safe-error";

type Goal = {
  id: string; title: string; description: string | null;
  target_date: string | null; progress: number; completed: boolean;
  sort_order: number;
};

type Task = {
  id: string; title: string; completed: boolean;
  due_date: string | null; goal_id: string | null; sort_order: number;
  priority: string;
};

export const Route = createFileRoute("/_authenticated/goals")({ component: Goals });

const TODAY = isoDay(new Date());
const WINDOW_START = (() => { const d = new Date(); d.setDate(d.getDate() - 89); return isoDay(d); })();

function Goals() {
  const qc = useQueryClient();
  const syncBadges = useBadgeSyncer();
  const [draft, setDraft] = useState("");
  const [date, setDate] = useState("");
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<Record<string, "tasks" | "habits">>({});
  const [period, setPeriod] = usePeriod("goals");
  const [editor, setEditor] = useState<{ goalId: string; habit?: HabitRow } | null>(null);

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
        .select("id,title,completed,due_date,goal_id,sort_order,priority")
        .not("goal_id", "is", null)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Task[];
    },
  });

  const { data: habits = [] } = useQuery({
    queryKey: ["habits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habits")
        .select("id,name,goal_id,frequency,custom_days,start_date,end_date,reminder_time,archived,sort_order")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as HabitRow[];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["habit_logs", WINDOW_START],
    queryFn: async () => {
      const { data, error } = await supabase.from("habit_logs").select("habit_id,date").gte("date", WINDOW_START);
      if (error) throw error;
      return (data ?? []) as { habit_id: string; date: string }[];
    },
  });

  /* ---------------- goals ---------------- */

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
    onError: (e: Error) => toast.error(safeErrorMessage(e, "Could not create goal")),
  });

  const editGoal = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Goal> }) => {
      const { error } = await supabase.from("goals").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); toast.success("Goal updated"); },
    onError: (e: Error) => toast.error(safeErrorMessage(e, "Could not update goal")),
  });

  const removeGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["tasks_for_goals"] });
      qc.invalidateQueries({ queryKey: ["habits"] });
      toast.success("Goal removed");
    },
    onError: (e: Error) => toast.error(safeErrorMessage(e, "Could not delete goal")),
  });

  // Goal progress = finite tasks only (habits tracked separately)
  const refreshProgress = async (goalId: string) => {
    const { data } = await supabase.from("tasks").select("completed").eq("goal_id", goalId);
    const all = data ?? [];
    const total = all.length;
    const done = all.filter(t => t.completed).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    await supabase.from("goals").update({ progress: pct, completed: pct >= 100 && total > 0 }).eq("id", goalId);
    if (pct >= 100 && total > 0) toast.success("🎉 Goal complete! Big move.");
    qc.invalidateQueries({ queryKey: ["goals"] });
    qc.invalidateQueries({ queryKey: ["goals_home"] });
  };

  /* ---------------- tasks ---------------- */

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
    onError: (e: Error) => toast.error(safeErrorMessage(e, "Could not add task")),
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
    onError: (e: Error) => toast.error(safeErrorMessage(e, "Could not update task")),
  });

  const editTask = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Task> }) => {
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks_for_goals"] }); toast.success("Task updated"); },
    onError: (e: Error) => toast.error(safeErrorMessage(e, "Could not update task")),
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
      toast.success("Task removed");
    },
    onError: (e: Error) => toast.error(safeErrorMessage(e, "Could not delete task")),
  });

  const reorderTasks = useMutation({
    mutationFn: async (next: Task[]) => {
      await Promise.all(next.map((t, i) => supabase.from("tasks").update({ sort_order: i }).eq("id", t.id)));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks_for_goals"] }),
  });

  /* ---------------- habits ---------------- */

  const saveHabit = useMutation({
    mutationFn: async ({ goalId, habitId, d }: { goalId: string; habitId?: string; d: HabitDraft }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const patch = {
        name: d.name,
        frequency: d.frequency,
        custom_days: d.frequency === "custom" ? d.custom_days : [],
        start_date: d.start_date,
        end_date: d.end_date,
        reminder_time: d.reminder_time,
      };
      if (habitId) {
        const { error } = await supabase.from("habits").update(patch as never).eq("id", habitId);
        if (error) throw error;
      } else {
        const goalHabits = habits.filter(h => h.goal_id === goalId);
        const nextOrder = (goalHabits[goalHabits.length - 1]?.sort_order ?? 0) + 1;
        const { error } = await supabase.from("habits")
          .insert({ ...patch, user_id: user.id, goal_id: goalId, sort_order: nextOrder } as never);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      setEditor(null);
      await syncBadges();
    },
    onError: (e: Error) => toast.error(safeErrorMessage(e, "Could not save habit")),
  });

  const toggleHabit = useMutation({
    mutationFn: async ({ habitId, done }: { habitId: string; done: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      if (done) {
        const { error } = await supabase.from("habit_logs").delete().eq("habit_id", habitId).eq("date", TODAY);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("habit_logs").insert({ habit_id: habitId, date: TODAY, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["habit_logs"] });
      qc.invalidateQueries({ queryKey: ["xp"] });
      qc.invalidateQueries({ queryKey: ["game_stats"] });
      await syncBadges();
    },
    onError: (e: Error) => toast.error(safeErrorMessage(e, "Could not update habit")),
  });

  const archiveHabit = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase.from("habits").update({ archived } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      toast.success(v.archived ? "Habit archived" : "Habit restored");
    },
    onError: (e: Error) => toast.error(safeErrorMessage(e, "Could not archive habit")),
  });

  const removeHabit = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("habit_logs").delete().eq("habit_id", id);
      const { error } = await supabase.from("habits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["habit_logs"] });
      toast.success("Habit removed");
    },
    onError: (e: Error) => toast.error(safeErrorMessage(e, "Could not delete habit")),
  });

  const logsByHabit = (id: string) => new Set(logs.filter(l => l.habit_id === id).map(l => l.date));

  return (
    <AppShell title="Goals" subtitle="Tasks + daily habits in one place">
      <div className="mb-4"><PeriodPicker value={period} onChange={setPeriod} /></div>
      <div className="mb-6"><GoalsAnalytics period={period} /></div>

      <form
        onSubmit={e => { e.preventDefault(); if (draft.trim()) addGoal.mutate(); }}
        className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] p-3 mb-6 nb-shadow"
      >
        <div className="flex items-center gap-2">
          <button type="submit" aria-label="Add goal" className="grid place-items-center size-10 shrink-0 rounded-xl bg-[var(--nb-orange)] text-[var(--nb-ink)] border-[2.5px] border-[var(--nb-ink)] nb-shadow tap-scale">
            <Plus className="size-4" strokeWidth={3} />
          </button>
          <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Name a goal worth pursuing…" className="min-w-0 flex-1 bg-transparent outline-none text-[15px] font-semibold placeholder:text-muted-foreground" />
        </div>
        <div className="mt-2 flex items-center gap-2 px-1">
          <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-muted-foreground outline-none" />
        </div>
      </form>

      {goals.length === 0 ? (
        <div className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] p-8 text-center nb-shadow">
          <Target className="size-6 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Name one meaningful goal, then break it into tasks and daily habits.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map(g => {
            const goalTasks = tasks.filter(t => t.goal_id === g.id);
            const goalHabits = habits.filter(h => h.goal_id === g.id);
            const active = goalHabits.filter(h => !h.archived);
            const done = goalTasks.filter(t => t.completed).length;
            const total = goalTasks.length;
            const pct = total === 0 ? 0 : Math.round((done / total) * 100);
            const isOpen = openIds[g.id] ?? false;
            const current = tab[g.id] ?? "tasks";
            const overdue = g.target_date && g.target_date < TODAY && pct < 100;

            // habit consistency over the last 30 scheduled days
            const from = (() => { const d = new Date(); d.setDate(d.getDate() - 29); return isoDay(d); })();
            let sched = 0, hit = 0;
            for (const h of active) {
              const set = logsByHabit(h.id);
              const days = scheduledDates(h, from, TODAY);
              sched += days.length;
              hit += days.filter(d2 => set.has(d2)).length;
            }
            const consistency = sched === 0 ? 0 : Math.round((hit / sched) * 100);
            const todaysHabits = active.filter(h => isScheduled(h, TODAY));
            const todayDone = todaysHabits.filter(h => logsByHabit(h.id).has(TODAY)).length;

            return (
              <div key={g.id} className={cn(
                "rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow overflow-hidden",
                pct >= 100 && total > 0 && "bg-[var(--nb-green)]/10"
              )}>
                <div className="flex items-start gap-2 p-4">
                  <button
                    onClick={() => setOpenIds(prev => ({ ...prev, [g.id]: !prev[g.id] }))}
                    className="flex-1 min-w-0 flex items-start gap-3 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="mt-1 shrink-0">
                      {isOpen ? <ChevronDown className="size-4" strokeWidth={3} /> : <ChevronRight className="size-4" strokeWidth={3} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-display text-xl leading-tight break-words", pct >= 100 && total > 0 && "line-through opacity-60")}>{g.title}</p>
                      {g.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{g.description}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-wider">
                        {g.target_date && (
                          <span className={cn("inline-flex items-center gap-1 font-bold", overdue ? "text-[var(--nb-pink)]" : "text-muted-foreground")}>
                            <Calendar className="size-3" />
                            {new Date(`${g.target_date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                        <span className="text-muted-foreground font-bold">{done}/{total} tasks</span>
                        {active.length > 0 && <span className="text-muted-foreground font-bold">{consistency}% habits</span>}
                        <span className={cn("px-2 py-0.5 rounded-full font-black border-[2px] border-[var(--nb-ink)]",
                          pct >= 100 && total > 0 ? "bg-[var(--nb-green)] text-[var(--nb-ink)]" : overdue ? "bg-[var(--nb-pink)] text-white" : "bg-[var(--nb-yellow)] text-[var(--nb-ink)]")}>
                          {pct >= 100 && total > 0 ? "Done" : overdue ? "Overdue" : "Active"}
                        </span>
                      </div>
                      <div className="mt-3 h-2.5 w-full rounded-full bg-muted overflow-hidden border-[1.5px] border-[var(--nb-ink)]">
                        <div className="h-full bg-[var(--nb-orange)] transition-[width] duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => {
                        const t = prompt("Edit goal title", g.title);
                        if (t === null) return;
                        const desc = prompt("Description (blank for none)", g.description ?? "");
                        if (desc === null) return;
                        const d = prompt("Target date (YYYY-MM-DD, blank for none)", g.target_date ?? "");
                        if (d === null) return;
                        editGoal.mutate({ id: g.id, patch: { title: t.trim() || g.title, description: desc.trim() || null, target_date: d.trim() || null } });
                      }}
                      className="grid place-items-center size-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                      aria-label="Edit goal"
                    ><Pencil className="size-4" /></button>
                    <button
                      onClick={() => { if (confirm("Delete this goal with its tasks and habits?")) removeGoal.mutate(g.id); }}
                      className="grid place-items-center size-9 rounded-lg text-muted-foreground hover:text-[var(--nb-pink)] hover:bg-muted"
                      aria-label="Delete goal"
                    ><Trash2 className="size-4" /></button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t-[2.5px] border-[var(--nb-ink)] bg-muted/20 p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {(["tasks", "habits"] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setTab(prev => ({ ...prev, [g.id]: t }))}
                          className={cn(
                            "inline-flex items-center justify-center gap-1.5 rounded-xl border-[2.5px] border-[var(--nb-ink)] py-2 text-xs font-black uppercase tracking-wider tap-scale",
                            current === t ? (t === "tasks" ? "bg-[var(--nb-orange)] nb-shadow" : "bg-[var(--nb-blue)] text-white nb-shadow") : "bg-white text-[var(--nb-ink)]"
                          )}
                        >
                          {t === "tasks" ? <ListChecks className="size-3.5" strokeWidth={3} /> : <Repeat className="size-3.5" strokeWidth={3} />}
                          {t === "tasks" ? `Tasks ${done}/${total}` : `Habits ${todayDone}/${todaysHabits.length}`}
                        </button>
                      ))}
                    </div>

                    {current === "tasks" ? (
                      <div className="space-y-2">
                        {goalTasks.length === 0 && (
                          <p className="text-xs text-muted-foreground px-2 py-1">No tasks yet — break this goal into finite steps.</p>
                        )}
                        <SortableList
                          items={goalTasks}
                          onReorder={next => reorderTasks.mutate(next)}
                          className="space-y-2"
                          renderItem={(t, handle) => (
                            <div className="flex items-center gap-2 px-2 py-2 rounded-xl bg-card border-[2px] border-[var(--nb-ink)]/40 hover:border-[var(--nb-ink)] transition-colors">
                              {handle}
                              <button
                                onClick={() => toggleTask.mutate(t)}
                                className={cn(
                                  "size-6 shrink-0 rounded-md border-[2.5px] border-[var(--nb-ink)] grid place-items-center transition-all tap-scale",
                                  t.completed ? "bg-[var(--nb-green)]" : "bg-white"
                                )}
                                aria-label={t.completed ? "Mark task incomplete" : "Mark task complete"}
                              >
                                {t.completed && <CheckCircle2 className="size-4 text-[var(--nb-ink)]" strokeWidth={3} />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-sm break-words", t.completed && "line-through text-muted-foreground")}>{t.title}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                  {t.due_date && (
                                    <span className={cn("text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1",
                                      !t.completed && t.due_date < TODAY ? "text-[var(--nb-pink)]" : "text-muted-foreground")}>
                                      <Calendar className="size-3" />{new Date(`${t.due_date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                    </span>
                                  )}
                                  {t.priority && t.priority !== "none" && (
                                    <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border-[1.5px] border-[var(--nb-ink)] bg-[var(--nb-yellow)]">{t.priority}</span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  const title = prompt("Task name", t.title);
                                  if (title === null) return;
                                  const due = prompt("Due date (YYYY-MM-DD, blank for none)", t.due_date ?? "");
                                  if (due === null) return;
                                  const pri = prompt("Priority (none / low / medium / high)", t.priority || "none");
                                  if (pri === null) return;
                                  const p = ["none", "low", "medium", "high"].includes(pri.trim().toLowerCase()) ? pri.trim().toLowerCase() : "none";
                                  editTask.mutate({ id: t.id, patch: { title: title.trim() || t.title, due_date: due.trim() || null, priority: p } });
                                }}
                                className="grid place-items-center size-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                                aria-label="Edit task"
                              ><Pencil className="size-3.5" /></button>
                              <button
                                onClick={() => { if (confirm("Delete this task?")) removeTask.mutate(t); }}
                                className="grid place-items-center size-8 shrink-0 rounded-lg text-muted-foreground hover:text-[var(--nb-pink)]"
                                aria-label="Delete task"
                              ><Trash2 className="size-3.5" /></button>
                            </div>
                          )}
                        />
                        <AddTaskRow onAdd={(title) => addTask.mutate({ goalId: g.id, title })} />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {active.length === 0 && goalHabits.length === 0 && (
                          <p className="text-xs text-muted-foreground px-2 py-1">No habits yet — add a repeated behaviour that moves this goal forward.</p>
                        )}
                        {goalHabits.map(h => {
                          const set = logsByHabit(h.id);
                          const days = scheduledDates(h, WINDOW_START, TODAY);
                          const { current: cur, best } = streaks(days, set, TODAY);
                          const rate = days.length === 0 ? 0 : Math.round((days.filter(d2 => set.has(d2)).length / days.length) * 100);
                          const scheduledToday = isScheduled(h, TODAY) && !h.archived;
                          const doneToday = set.has(TODAY);
                          return (
                            <div key={h.id} className={cn(
                              "rounded-xl bg-card border-[2px] border-[var(--nb-ink)]/40 p-2.5",
                              h.archived && "opacity-60"
                            )}>
                              <div className="flex items-center gap-2">
                                <button
                                  disabled={!scheduledToday}
                                  onClick={() => toggleHabit.mutate({ habitId: h.id, done: doneToday })}
                                  className={cn(
                                    "size-7 shrink-0 rounded-md border-[2.5px] border-[var(--nb-ink)] grid place-items-center tap-scale",
                                    doneToday ? "bg-[var(--nb-green)]" : "bg-white",
                                    !scheduledToday && "opacity-40 cursor-not-allowed"
                                  )}
                                  aria-label={doneToday ? "Undo habit completion" : "Mark habit complete"}
                                >
                                  {doneToday && <CheckCircle2 className="size-4" strokeWidth={3} />}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold break-words">{h.name}</p>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                    <span className="inline-flex items-center gap-1"><Repeat className="size-3" />{frequencyLabel(h)}</span>
                                    {h.reminder_time && <span className="inline-flex items-center gap-1"><Clock className="size-3" />{h.reminder_time.slice(0, 5)}</span>}
                                    <span className="inline-flex items-center gap-1 text-[var(--nb-ink)]"><Flame className="size-3" />{cur} · best {best}</span>
                                    <span>{rate}%</span>
                                    {h.archived && <span className="px-1.5 py-0.5 rounded border-[1.5px] border-[var(--nb-ink)] bg-muted">Archived</span>}
                                  </div>
                                </div>
                                <button onClick={() => setEditor({ goalId: g.id, habit: h })} aria-label="Edit habit"
                                  className="grid place-items-center size-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"><Pencil className="size-3.5" /></button>
                                <button onClick={() => archiveHabit.mutate({ id: h.id, archived: !h.archived })} aria-label={h.archived ? "Restore habit" : "Archive habit"}
                                  className="grid place-items-center size-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"><Archive className="size-3.5" /></button>
                                <button onClick={() => { if (confirm(`Delete "${h.name}" and its history?`)) removeHabit.mutate(h.id); }} aria-label="Delete habit"
                                  className="grid place-items-center size-8 shrink-0 rounded-lg text-muted-foreground hover:text-[var(--nb-pink)]"><Trash2 className="size-3.5" /></button>
                              </div>
                              <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden border-[1.5px] border-[var(--nb-ink)]">
                                <div className="h-full bg-[var(--nb-blue)]" style={{ width: `${rate}%` }} />
                              </div>
                            </div>
                          );
                        })}
                        <button
                          onClick={() => setEditor({ goalId: g.id })}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-[2.5px] border-dashed border-[var(--nb-ink)] py-2.5 text-xs font-black uppercase tracking-wider tap-scale"
                        ><Plus className="size-3.5" strokeWidth={3} /> Add daily habit</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <HabitEditor
        open={!!editor}
        initial={editor?.habit}
        title={editor?.habit ? "Edit habit" : "New daily habit"}
        onClose={() => setEditor(null)}
        onSave={(d) => editor && saveHabit.mutate({ goalId: editor.goalId, habitId: editor.habit?.id, d })}
      />
    </AppShell>
  );
}

function AddTaskRow({ onAdd }: { onAdd: (title: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <form
      onSubmit={e => { e.preventDefault(); if (val.trim()) { onAdd(val.trim()); setVal(""); } }}
      className="flex items-center gap-2 px-1 py-1"
    >
      <button type="submit" className="grid place-items-center size-8 shrink-0 rounded-md bg-[var(--nb-yellow)] border-[2px] border-[var(--nb-ink)] tap-scale" aria-label="Add task">
        <Plus className="size-3.5" strokeWidth={3} />
      </button>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder="Add a step…"
        className="min-w-0 flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
      />
    </form>
  );
}
