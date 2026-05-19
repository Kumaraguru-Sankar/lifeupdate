import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Entry = { id: string; date: string; mood: number; body: string };

const MOODS = ["😔", "😕", "😐", "🙂", "😄"];

export const Route = createFileRoute("/journal")({ component: Journal });

function todayKey() { return new Date().toISOString().slice(0, 10); }

function Journal() {
  const [entries, setEntries] = useLocalStorage<Entry[]>("lifeos.journal", []);
  const today = todayKey();
  const todayEntry = entries.find(e => e.date === today);

  const [mood, setMood] = useState<number>(todayEntry?.mood ?? 3);
  const [body, setBody] = useState<string>(todayEntry?.body ?? "");

  const save = () => {
    const updated: Entry = { id: todayEntry?.id ?? crypto.randomUUID(), date: today, mood, body };
    const next = todayEntry ? entries.map(e => e.id === todayEntry.id ? updated : e) : [updated, ...entries];
    setEntries(next);
  };

  const past = entries.filter(e => e.date !== today).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <AppShell title="Journal" subtitle={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}>
      <section className="rounded-2xl bg-card border border-border/60 p-5 mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">How do you feel?</p>
        <div className="flex justify-between mb-5">
          {MOODS.map((m, i) => (
            <button
              key={i}
              onClick={() => setMood(i)}
              className={cn(
                "size-12 rounded-full text-2xl grid place-items-center transition-all",
                mood === i ? "bg-accent scale-110" : "bg-muted/50 hover:bg-muted"
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          onBlur={save}
          placeholder="What's on your mind today?"
          rows={8}
          className="w-full bg-transparent outline-none text-[15px] leading-relaxed resize-none placeholder:text-muted-foreground"
        />
        <button onClick={save} className="mt-3 rounded-full bg-foreground text-background px-5 py-2 text-sm">Save entry</button>
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Past entries</h2>
          <ul className="space-y-2">
            {past.map(e => (
              <li key={e.id} className="rounded-2xl bg-card border border-border/60 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{new Date(e.date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</span>
                  <span className="text-2xl">{MOODS[e.mood]}</span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{e.body || "—"}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}
