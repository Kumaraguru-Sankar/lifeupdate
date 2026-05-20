import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type Note = { id: string; title: string; content: string; updated_at: string };

export const Route = createFileRoute("/_authenticated/notes")({ component: Notes });

function Notes() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: notes = [] } = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notes").select("id,title,content,updated_at").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
  });

  const active = notes.find(n => n.id === activeId) ?? null;

  const create = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase.from("notes").insert({ user_id: user.id, title: "Untitled", content: "" }).select().single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      setActiveId(n.id);
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Note> }) => {
      const { error } = await supabase.from("notes").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });

  if (active) return <Editor note={active} onClose={() => setActiveId(null)} onSave={(patch) => update.mutate({ id: active.id, patch })} />;

  return (
    <AppShell
      title="Notes"
      subtitle={`${notes.length} captured`}
      action={
        <button onClick={() => create.mutate()} className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-2 text-sm">
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
                <p className="text-sm text-muted-foreground line-clamp-2">{n.content || "No content yet."}</p>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-2">
                  {new Date(n.updated_at).toLocaleDateString()}
                </p>
              </button>
              <button onClick={() => remove.mutate(n.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

function Editor({ note, onClose, onSave }: { note: Note; onClose: () => void; onSave: (patch: Partial<Note>) => void }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);

  useEffect(() => { setTitle(note.title); setContent(note.content); }, [note.id]);

  // debounce save
  useEffect(() => {
    if (title === note.title && content === note.content) return;
    const t = setTimeout(() => onSave({ title, content }), 600);
    return () => clearTimeout(t);
  }, [title, content]);

  return (
    <AppShell
      title="Editing"
      subtitle={new Date(note.updated_at).toLocaleString()}
      action={<button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Done</button>}
    >
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full bg-transparent outline-none font-display text-3xl mb-4"
      />
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Start writing…"
        rows={18}
        className="w-full bg-transparent outline-none text-[15px] leading-relaxed resize-none placeholder:text-muted-foreground"
      />
    </AppShell>
  );
}
