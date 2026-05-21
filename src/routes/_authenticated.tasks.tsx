import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Plus, Trash2, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

type Recurrence = "none" | "daily" | "weekly" | "monthly";
type Task = { id: string; title: string; completed: boolean; created_at: string; recurrence: Recurrence; due_date: string | null };

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
  const [draft, setDraft] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("id,title,completed,created_at,recurrence,due_date").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const title = draft.trim();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("tasks").insert({ title, user_id: user.id, recurrence });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setDraft(""); },
  });

  const toggle = useMutation({
    mutationFn: async (t: Task) => {
      const completing = !t.completed;
      const { error } = await supabase.from("tasks").update({ completed: completing }).eq("id", t.id);
      if (error) throw error;
      // Auto-spawn next occurrence on completion
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["xp"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const submit = (e: React.FormEvent) => { e.preventDefault(); if (draft.trim()) add.mutate(); };

  const open = tasks.filter(t => !t.completed);
  const done = tasks.filter(t => t.completed);

  return (
    <AppShell title="Tasks" subtitle={`${open.length} open · ${done.length} done`}>
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

      <List title="To do" tasks={open} onToggle={t => toggle.mutate(t)} onRemove={id => remove.mutate(id)} emptyText="Inbox zero. Beautiful." />
      <List title="Done" tasks={done} onToggle={t => toggle.mutate(t)} onRemove={id => remove.mutate(id)} emptyText="" muted />
    </AppShell>
  );
}

function List({ title, tasks, onToggle, onRemove, emptyText, muted }: {
  title: string; tasks: Task[]; onToggle: (t: Task) => void; onRemove: (id: string) => void; emptyText: string; muted?: boolean;
}) {
  if (tasks.length === 0 && !emptyText) return null;
  return (
    <section className="mb-8">
      <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">{title}</h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">{emptyText}</p>
      ) : (
        <ul className="rounded-2xl bg-card border border-border/60 divide-y divide-border/60 overflow-hidden stagger">
          {tasks.map(t => (
            <li key={t.id} className="group flex items-center gap-3 px-4 py-3">
              <button onClick={() => onToggle(t)} className={cn("size-5 rounded-full border-2 transition-all duration-300 ease-out-soft grid place-items-center", t.completed ? "bg-accent border-accent scale-105" : "border-border hover:border-accent")} aria-label="Toggle">
                {t.completed && <span className="size-2 rounded-full bg-accent-foreground" />}
              </button>
              <div className="flex-1 min-w-0">
                <span className={cn("block text-[15px] truncate", t.completed && "text-muted-foreground line-through", muted && "text-muted-foreground")}>{t.title}</span>
                {t.recurrence !== "none" && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1 mt-0.5"><Repeat className="size-2.5" /> {t.recurrence}</span>
                )}
              </div>
              <button onClick={() => onRemove(t.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
