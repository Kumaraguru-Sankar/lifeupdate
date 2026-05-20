import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Entry = { id: string; entry_date: string; mood: string | null; content: string };

const MOODS = ["😔", "😕", "😐", "🙂", "😄"];

export const Route = createFileRoute("/_authenticated/journal")({ component: Journal });

function todayKey() { return new Date().toISOString().slice(0, 10); }

function Journal() {
  const qc = useQueryClient();
  const today = todayKey();

  const { data: entries = [] } = useQuery({
    queryKey: ["journal"],
    queryFn: async () => {
      const { data, error } = await supabase.from("journal_entries").select("id,entry_date,mood,content").order("entry_date", { ascending: false });
      if (error) throw error;
      return data as Entry[];
    },
  });

  const todayEntry = entries.find(e => e.entry_date === today);
  const [mood, setMood] = useState<number>(todayEntry?.mood ? Number(todayEntry.mood) : 3);
  const [body, setBody] = useState<string>(todayEntry?.content ?? "");

  useEffect(() => {
    if (todayEntry) {
      setMood(todayEntry.mood ? Number(todayEntry.mood) : 3);
      setBody(todayEntry.content);
    }
  }, [todayEntry?.id]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      if (todayEntry) {
        const { error } = await supabase.from("journal_entries").update({ mood: String(mood), content: body }).eq("id", todayEntry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("journal_entries").insert({ user_id: user.id, entry_date: today, mood: String(mood), content: body });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal"] }),
  });

  const past = entries.filter(e => e.entry_date !== today);

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
          onBlur={() => save.mutate()}
          placeholder="What's on your mind today?"
          rows={8}
          className="w-full bg-transparent outline-none text-[15px] leading-relaxed resize-none placeholder:text-muted-foreground"
        />
        <button onClick={() => save.mutate()} className="mt-3 rounded-full bg-foreground text-background px-5 py-2 text-sm">Save entry</button>
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Past entries</h2>
          <ul className="space-y-2">
            {past.map(e => (
              <li key={e.id} className="rounded-2xl bg-card border border-border/60 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{new Date(e.entry_date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</span>
                  <span className="text-2xl">{e.mood !== null ? MOODS[Number(e.mood)] : "—"}</span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{e.content || "—"}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}
