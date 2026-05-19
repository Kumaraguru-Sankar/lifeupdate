import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type Note = { id: string; title: string; body: string; updatedAt: number };

export const Route = createFileRoute("/notes")({ component: Notes });

function Notes() {
  const [notes, setNotes] = useLocalStorage<Note[]>("lifeos.notes", []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = notes.find(n => n.id === activeId) ?? null;

  const create = () => {
    const n: Note = { id: crypto.randomUUID(), title: "Untitled", body: "", updatedAt: Date.now() };
    setNotes([n, ...notes]);
    setActiveId(n.id);
  };

  const update = (patch: Partial<Note>) => {
    if (!active) return;
    setNotes(notes.map(n => n.id === active.id ? { ...n, ...patch, updatedAt: Date.now() } : n));
  };
  const remove = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
    if (activeId === id) setActiveId(null);
  };

  if (active) {
    return (
      <AppShell
        title="Editing"
        subtitle={new Date(active.updatedAt).toLocaleString()}
        action={
          <button onClick={() => setActiveId(null)} className="text-sm text-muted-foreground hover:text-foreground">Done</button>
        }
      >
        <input
          value={active.title}
          onChange={e => update({ title: e.target.value })}
          placeholder="Title"
          className="w-full bg-transparent outline-none font-display text-3xl mb-4"
        />
        <textarea
          value={active.body}
          onChange={e => update({ body: e.target.value })}
          placeholder="Start writing…"
          rows={18}
          className="w-full bg-transparent outline-none text-[15px] leading-relaxed resize-none placeholder:text-muted-foreground"
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Notes"
      subtitle={`${notes.length} captured`}
      action={
        <button onClick={create} className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-2 text-sm">
          <Plus className="size-4" /> New
        </button>
      }
    >
      {notes.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border/60 p-8 text-center">
          <p className="text-sm text-muted-foreground">A blank page is full of possibility. Tap New to begin.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notes.map(n => (
            <li key={n.id} className="group rounded-2xl bg-card border border-border/60 p-4 flex items-start gap-3">
              <button onClick={() => setActiveId(n.id)} className="flex-1 text-left">
                <div className="font-medium mb-1 truncate">{n.title || "Untitled"}</div>
                <p className="text-sm text-muted-foreground line-clamp-2">{n.body || "No content yet."}</p>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-2">
                  {new Date(n.updatedAt).toLocaleDateString()}
                </p>
              </button>
              <button onClick={() => remove(n.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
