import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Task = { id: string; title: string; completed: boolean; created_at: string };

export const Route = createFileRoute("/_authenticated/tasks")({ component: Tasks });

function Tasks() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("id,title,completed,created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });

  const add = useMutation({
    mutationFn: async (title: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("tasks").insert({ title, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const toggle = useMutation({
    mutationFn: async (t: Task) => {
      const { error } = await supabase.from("tasks").update({ completed: !t.completed }).eq("id", t.id);
      if (error) throw error;
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    add.mutate(title);
    setDraft("");
  };

  const open = tasks.filter(t => !t.completed);
  const done = tasks.filter(t => t.completed);

  return (
    <AppShell title="Tasks" subtitle={`${open.length} open · ${done.length} done`}>
      <form
        onSubmit={submit}
        className="flex items-center gap-2 rounded-2xl bg-card border border-border/60 px-3 py-2 mb-6 focus-within:border-accent/60 transition-colors"
      >
        <button type="submit" className="grid place-items-center size-9 rounded-xl bg-accent text-accent-foreground">
          <Plus className="size-4" />
        </button>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="What needs doing?"
          className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-muted-foreground"
        />
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
        <ul className="rounded-2xl bg-card border border-border/60 divide-y divide-border/60 overflow-hidden">
          {tasks.map(t => (
            <li key={t.id} className="group flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => onToggle(t)}
                className={cn(
                  "size-5 rounded-full border-2 transition-colors grid place-items-center",
                  t.completed ? "bg-accent border-accent" : "border-border hover:border-accent"
                )}
                aria-label="Toggle"
              >
                {t.completed && <span className="size-2 rounded-full bg-accent-foreground" />}
              </button>
              <span className={cn("flex-1 text-[15px]", t.completed && "text-muted-foreground line-through", muted && "text-muted-foreground")}>
                {t.title}
              </span>
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
