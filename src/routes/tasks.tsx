import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Task = { id: string; title: string; done: boolean; createdAt: number };

export const Route = createFileRoute("/tasks")({ component: Tasks });

function Tasks() {
  const [tasks, setTasks] = useLocalStorage<Task[]>("lifeos.tasks", []);
  const [draft, setDraft] = useState("");

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    setTasks([{ id: crypto.randomUUID(), title, done: false, createdAt: Date.now() }, ...tasks]);
    setDraft("");
  };

  const toggle = (id: string) =>
    setTasks(tasks.map(t => (t.id === id ? { ...t, done: !t.done } : t)));
  const remove = (id: string) => setTasks(tasks.filter(t => t.id !== id));

  const open = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);

  return (
    <AppShell title="Tasks" subtitle={`${open.length} open · ${done.length} done`}>
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
          placeholder="What needs doing?"
          className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-muted-foreground"
        />
      </form>

      <List title="To do" tasks={open} onToggle={toggle} onRemove={remove} emptyText="Inbox zero. Beautiful." />
      <List title="Done" tasks={done} onToggle={toggle} onRemove={remove} emptyText="" muted />
    </AppShell>
  );
}

function List({ title, tasks, onToggle, onRemove, emptyText, muted }: {
  title: string; tasks: Task[]; onToggle: (id: string) => void; onRemove: (id: string) => void; emptyText: string; muted?: boolean;
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
                onClick={() => onToggle(t.id)}
                className={cn(
                  "size-5 rounded-full border-2 transition-colors grid place-items-center",
                  t.done ? "bg-accent border-accent" : "border-border hover:border-accent"
                )}
                aria-label="Toggle"
              >
                {t.done && <span className="size-2 rounded-full bg-accent-foreground" />}
              </button>
              <span className={cn("flex-1 text-[15px]", t.done && "text-muted-foreground line-through", muted && "text-muted-foreground")}>
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
