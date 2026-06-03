import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Search, NotebookPen, BookOpen, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

type Note = { id: string; title: string; content: string; updated_at: string };
type Entry = { id: string; entry_date: string; mood: string | null; content: string; updated_at: string };

const MOODS = ["😔", "😕", "😐", "🙂", "😄"];
type Tab = "all" | "notes" | "journal";

export const Route = createFileRoute("/_authenticated/notes")({ component: NotesAndJournal });

function todayKey() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d: string) { return new Date(d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric" }); }

function NotesAndJournal() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);

  const notesQ = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notes").select("id,title,content,updated_at").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
  });

  const journalQ = useQuery({
    queryKey: ["journal"],
    queryFn: async () => {
      const { data, error } = await supabase.from("journal_entries").select("id,entry_date,mood,content,updated_at").order("entry_date", { ascending: false });
      if (error) throw error;
      return data as Entry[];
    },
  });

  const createNote = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase.from("notes").insert({ user_id: user.id, title: "Untitled", content: "" }).select().single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ["notes"] }); setEditingNote(n); },
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Note> }) => {
      const { error } = await supabase.from("notes").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });

  const removeNote = useMutation({
    mutationFn: async (id: string) => { await supabase.from("notes").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });

  const createEntry = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const today = todayKey();
      // Use today if no entry exists, else just a new dated entry equal to today (allow multiple).
      const { data, error } = await supabase.from("journal_entries").insert({
        user_id: user.id, entry_date: today, mood: "3", content: "",
      }).select().single();
      if (error) throw error;
      return data as Entry;
    },
    onSuccess: (e) => { qc.invalidateQueries({ queryKey: ["journal"] }); setEditingEntry(e); },
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Entry> }) => {
      const { error } = await supabase.from("journal_entries").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal"] }),
  });

  const removeEntry = useMutation({
    mutationFn: async (id: string) => { await supabase.from("journal_entries").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal"] }),
  });

  const notes = notesQ.data ?? [];
  const entries = journalQ.data ?? [];

  const filteredNotes = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return notes;
    return notes.filter(n => n.title.toLowerCase().includes(s) || n.content.toLowerCase().includes(s));
  }, [notes, search]);

  const filteredEntries = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return entries;
    return entries.filter(e => e.content.toLowerCase().includes(s) || e.entry_date.includes(s));
  }, [entries, search]);

  if (editingNote) {
    return <NoteEditor note={editingNote} onClose={() => setEditingNote(null)} onSave={(patch) => updateNote.mutate({ id: editingNote.id, patch })} />;
  }
  if (editingEntry) {
    return <EntryEditor entry={editingEntry} onClose={() => setEditingEntry(null)} onSave={(patch) => updateEntry.mutate({ id: editingEntry.id, patch })} />;
  }

  const showNotes = tab === "all" || tab === "notes";
  const showJournal = tab === "all" || tab === "journal";

  return (
    <AppShell
      title="Notes"
      subtitle={`${notes.length} notes · ${entries.length} entries`}
      action={
        <button
          onClick={() => tab === "journal" ? createEntry.mutate() : createNote.mutate()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--nb-blue)] text-white px-3 py-2 text-sm font-bold border-[3px] border-[var(--nb-ink)] nb-shadow tap-scale"
        >
          <Plus className="size-4" strokeWidth={3} /> New
        </button>
      }
    >
      {/* Tabs */}
      <div className="flex items-center gap-1.5 mb-4 rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] p-1.5 nb-shadow">
        {([
          { id: "all", label: "All" },
          { id: "notes", label: "Notes" },
          { id: "journal", label: "Journal" },
        ] as { id: Tab; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-xl px-3 py-2 text-sm font-bold tap-scale transition-all border-[2.5px]",
              tab === t.id
                ? "bg-[var(--nb-yellow)] border-[var(--nb-ink)] nb-shadow"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-5 rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] px-3 py-2.5">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search notes and journal…"
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
      </div>

      {showNotes && (
        <section className="mb-8">
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3 inline-flex items-center gap-2">
            <NotebookPen className="size-3.5" /> Notes
          </h2>
          {filteredNotes.length === 0 ? (
            <div className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] p-6 text-center nb-shadow">
              <p className="text-sm text-muted-foreground">{search ? "No notes match." : "A blank page is full of possibility. Tap New to begin."}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredNotes.map(n => (
                <li key={n.id} className="group rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow p-4 flex items-start gap-3">
                  <button onClick={() => setEditingNote(n)} className="flex-1 text-left min-w-0">
                    <div className="font-display text-lg mb-1 truncate">{n.title || "Untitled"}</div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{n.content || "No content yet."}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2 font-bold">
                      {fmtDate(n.updated_at)}
                    </p>
                  </button>
                  <button
                    onClick={() => { if (confirm("Delete this note?")) removeNote.mutate(n.id); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[var(--nb-pink)] transition-opacity"
                    aria-label="Delete note"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {showJournal && (
        <section>
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3 inline-flex items-center gap-2">
            <BookOpen className="size-3.5" /> Journal
          </h2>
          {filteredEntries.length === 0 ? (
            <div className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] p-6 text-center nb-shadow">
              <p className="text-sm text-muted-foreground">{search ? "No entries match." : "Reflect on today. Tap New for a fresh entry."}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredEntries.map(e => (
                <li key={e.id} className="group rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow p-4 flex items-start gap-3">
                  <span className="grid place-items-center size-10 rounded-xl bg-[var(--nb-pink)]/15 border-[2.5px] border-[var(--nb-ink)] text-2xl">
                    {e.mood !== null ? MOODS[Number(e.mood)] ?? "📝" : "📝"}
                  </span>
                  <button onClick={() => setEditingEntry(e)} className="flex-1 text-left min-w-0">
                    <div className="font-display text-lg mb-0.5">{fmtDate(e.entry_date)}</div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Daily reflection</p>
                    <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">{e.content || "—"}</p>
                  </button>
                  <button
                    onClick={() => { if (confirm("Delete this entry?")) removeEntry.mutate(e.id); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[var(--nb-pink)] transition-opacity"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </AppShell>
  );
}

function NoteEditor({ note, onClose, onSave }: { note: Note; onClose: () => void; onSave: (patch: Partial<Note>) => void }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);

  useEffect(() => { setTitle(note.title); setContent(note.content); }, [note.id]);

  useEffect(() => {
    if (title === note.title && content === note.content) return;
    const t = setTimeout(() => onSave({ title, content }), 600);
    return () => clearTimeout(t);
  }, [title, content]);

  return (
    <AppShell
      title="Editing note"
      subtitle={fmtDate(note.updated_at)}
      action={
        <button onClick={onClose} className="rounded-xl bg-[var(--nb-yellow)] border-[3px] border-[var(--nb-ink)] px-4 py-2 text-sm font-bold nb-shadow tap-scale">Done</button>
      }
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

function EntryEditor({ entry, onClose, onSave }: { entry: Entry; onClose: () => void; onSave: (patch: Partial<Entry>) => void }) {
  const [mood, setMood] = useState<number>(entry.mood ? Number(entry.mood) : 3);
  const [content, setContent] = useState(entry.content);

  useEffect(() => { setMood(entry.mood ? Number(entry.mood) : 3); setContent(entry.content); }, [entry.id]);

  useEffect(() => {
    if (String(mood) === entry.mood && content === entry.content) return;
    const t = setTimeout(() => onSave({ mood: String(mood), content }), 600);
    return () => clearTimeout(t);
  }, [mood, content]);

  return (
    <AppShell
      title="Daily reflection"
      subtitle={fmtDate(entry.entry_date)}
      action={
        <button onClick={onClose} className="rounded-xl bg-[var(--nb-yellow)] border-[3px] border-[var(--nb-ink)] px-4 py-2 text-sm font-bold nb-shadow tap-scale">Done</button>
      }
    >
      <section className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow p-5 mb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3 font-bold">How do you feel?</p>
        <div className="flex justify-between">
          {MOODS.map((m, i) => (
            <button
              key={i}
              onClick={() => setMood(i)}
              className={cn(
                "size-12 rounded-xl text-2xl grid place-items-center transition-all border-[2.5px]",
                mood === i ? "bg-[var(--nb-pink)] border-[var(--nb-ink)] nb-shadow scale-110" : "border-transparent bg-muted/40 hover:bg-muted"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </section>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="What's on your mind today?"
        rows={14}
        className="w-full bg-transparent outline-none text-[15px] leading-relaxed resize-none placeholder:text-muted-foreground"
      />
    </AppShell>
  );
}
