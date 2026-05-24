import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Plus, Trash2, Repeat, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { SortableList } from "@/components/sortable-list";
import { useBadgeSyncer } from "@/lib/badges";
import { toast } from "sonner";

type Recurrence = "none" | "daily" | "weekly" | "monthly";
type Task = { id: string; title: string; completed: boolean; created_at: string; recurrence: Recurrence; due_date: string | null; sort_order: number };

export const Route = createFileRoute("/_authenticated/tasks")({ component: Tasks });

const RECURRENCES: { value: Recurrence; label: string }[] = [
  { value: "none", label: "Once" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }

function Tasks() {
  const qc = useQueryClient();
  const syncBadges = useBadgeSyncer();
  const [draft, setDraft] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,completed,created_at,recurrence,due_date,sort_order")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const title = draft.trim();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const nextOrder = (tasks[0]?.sort_order ?? 0) - 1;
      const { error } = await supabase.from("tasks").insert({ title, user_id: user.id, recurrence, sort_order: nextOrder });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setDraft(""); },
  });

  const toggle = useMutation({
    mutationFn: async (t: Task) => {
      const completing = !t.completed;
      const { error } = await supabase.from("tasks").update({ completed: completing }).eq("id", t.id);
      if (error) throw error;
      if (completing && t.recurrence !== "none") {
        const base = t.due_date ? new Date(t.due_date) : new Date();
        const next = t.recurrence === "daily" ? addDays(base, 1) : t.recurrence === "weekly" ? addDays(base, 7) : addMonths(base, 1);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("tasks").insert({
            title: t.title, user_id: user.id, recurrence: t.recurrence,
            due_date: next.toISOString().slice(0, 10), recurrence_parent_id: t.id,
          });
        }
      }
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["xp"] });
      qc.invalidateQueries({ queryKey: ["game_stats"] });
      await syncBadges();
    },
  });

  const editTask = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase.from("tasks").update({ title }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Task updated"); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id, i) => supabase.from("tasks").update({ sort_order: i }).eq("id", id)));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const submit = (e: React.FormEvent) => { e.preventDefault(); if (draft.trim()) add.mutate(); };

  const open = tasks.filter(t => !t.completed);
  const done = tasks.filter(t => t.completed);

  return (
    <AppShell title="Tasks" subtitle={`${open.length} open · ${done.length} done · drag to reorder`}>
      <form onSubmit={submit} className="rounded-2xl bg-card border border-border/60 p-3 mb-6 shadow-soft focus-within:border-accent/60 transition-colors">
        <div className="flex items-center gap-2">
          <button type="submit" className="grid place-items-center size-9 rounded-xl bg-accent text-accent-foreground tap-scale"><Plus className="size-4" /></button>
          <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="What needs doing?" className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-muted-foreground" />
        </div>
        <div className="mt-2 flex items-center gap-1 px-1 overflow-x-auto">
          <Repeat className="size-3 text-muted-foreground mr-1" />
          {RECURRENCES.map(r => (
            <button key={r.value} type="button" onClick={() => setRecurrence(r.value)} className={cn("text-[11px] px-2 py-1 rounded-full transition-colors", recurrence === r.value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}>{r.label}</button>
          ))}
        </div>
      </form>

      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">To do</h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">Inbox zero. Beautiful.</p>
        ) : (
          <div className="rounded-2xl bg-card border border-border/60 overflow-hidden">
            <SortableList
              items={open}
              onReorder={next => reorder.mutate([...next.map(t => t.id), ...done.map(t => t.id)])}
              className="divide-y divide-border/60"
              renderItem={(t, handle) => (
                <TaskRow
                  task={t}
                  handle={handle}
                  onToggle={() => toggle.mutate(t)}
                  onRemove={() => remove.mutate(t.id)}
                  onEdit={(title) => editTask.mutate({ id: t.id, title })}
                />
              )}
            />
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Done</h2>
          <ul className="rounded-2xl bg-card border border-border/60 divide-y divide-border/60 overflow-hidden">
            {done.map(t => (
              <TaskRow
                key={t.id}
                task={t}
                onToggle={() => toggle.mutate(t)}
                onRemove={() => remove.mutate(t.id)}
                onEdit={(title) => editTask.mutate({ id: t.id, title })}
                muted
              />
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}

function TaskRow({ task, handle, onToggle, onRemove, onEdit, muted }: {
  task: Task; handle?: React.ReactNode; onToggle: () => void; onRemove: () => void; onEdit: (title: string) => void; muted?: boolean;
}) {
  return (
    <div className="group flex items-center gap-2 px-3 py-3">
      {handle}
      <button onClick={onToggle} className={cn("size-5 rounded-full border-2 transition-all duration-300 ease-out-soft grid place-items-center", task.completed ? "bg-accent border-accent scale-105" : "border-border hover:border-accent")} aria-label="Toggle">
        {task.completed && <span className="size-2 rounded-full bg-accent-foreground" />}
      </button>
      <div className="flex-1 min-w-0">
        <span className={cn("block text-[15px] truncate", task.completed && "text-muted-foreground line-through", muted && "text-muted-foreground")}>{task.title}</span>
        {task.recurrence !== "none" && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1 mt-0.5"><Repeat className="size-2.5" /> {task.recurrence}</span>
        )}
      </div>
      <button
        onClick={() => {
          const next = prompt("Edit task", task.title);
          if (next && next.trim() && next !== task.title) onEdit(next.trim());
        }}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
        aria-label="Edit"
      >
        <Pencil className="size-4" />
      </button>
      <button
        onClick={() => { if (confirm("Delete this task?")) onRemove(); }}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
        aria-label="Delete"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
