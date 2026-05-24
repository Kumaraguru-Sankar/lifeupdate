import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Sparkles, Timer, Calendar, NotebookPen, Flame, ArrowRight } from "lucide-react";
import { useCommandPalette } from "@/components/command-palette";

export function InsightsPanel() {
  const { open } = useCommandPalette();
  const today = new Date().toISOString().slice(0, 10);

  const { data: msg } = useQuery({
    queryKey: ["ai_messages_last"],
    queryFn: async () => {
      const { data } = await supabase.from("ai_messages").select("role,content,created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const { data: pomos = [] } = useQuery({
    queryKey: ["pomodoros_recent"],
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 6);
      const { data } = await supabase.from("pomodoro_sessions").select("completed_at,duration_min").gte("completed_at", since.toISOString());
      return (data ?? []) as { completed_at: string; duration_min: number }[];
    },
  });


  const { data: logs30 = [] } = useQuery({
    queryKey: ["habit_logs_streak_30"],
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 29);
      const { data } = await supabase.from("habit_logs").select("date").gte("date", since.toISOString().slice(0, 10));
      return (data ?? []) as { date: string }[];
    },
  });

  const focusMinToday = pomos.filter(p => p.completed_at.slice(0, 10) === today).reduce((a, b) => a + (b.duration_min ?? 0), 0);

  const streak = useMemo(() => {
    const set = new Set(logs30.map(l => l.date));
    let s = 0;
    for (let i = 0; i < 60; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if (set.has(d.toISOString().slice(0, 10))) s++;
      else if (i > 0) break;
    }
    return s;
  }, [logs30]);

  const dayBars = useMemo(() => {
    const days: { label: string; min: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const min = pomos.filter(p => p.completed_at.slice(0, 10) === key).reduce((a, b) => a + (b.duration_min ?? 0), 0);
      days.push({ label: d.toLocaleDateString(undefined, { weekday: "narrow" }), min });
    }
    return days;
  }, [pomos]);
  const maxMin = Math.max(30, ...dayBars.map(d => d.min));

  return (
    <>
      <PanelCard>
        <PanelHeader icon={<Sparkles className="size-3.5" />} label="Assistant" to="/assistant" />
        <p className="text-[13px] leading-relaxed text-foreground/85 line-clamp-4 min-h-[3.5rem]">
          {msg?.content ?? "Ask LifeUpdate to plan your day, reflect on the week, or surface what matters next."}
        </p>
        <button
          onClick={open}
          className="mt-3 w-full rounded-xl bg-foreground text-background h-9 text-xs font-medium tap-scale inline-flex items-center justify-center gap-2"
        >
          <Sparkles className="size-3.5" /> Ask anything
        </button>
      </PanelCard>

      <PanelCard>
        <PanelHeader icon={<Timer className="size-3.5" />} label="Focus today" to="/focus" />
        <div className="flex items-baseline gap-2">
          <span className="font-display text-4xl leading-none">{focusMinToday}</span>
          <span className="text-xs text-muted-foreground">min deep work</span>
        </div>
        <div className="mt-4 flex items-end gap-1.5 h-16">
          {dayBars.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-md bg-accent/70 transition-all duration-700 ease-out-soft" style={{ height: `${Math.max(4, (d.min / maxMin) * 100)}%`, opacity: d.min === 0 ? 0.18 : 0.55 + (d.min / maxMin) * 0.45 }} />
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{d.label}</span>
            </div>
          ))}
        </div>
      </PanelCard>

      <PanelCard>
        <PanelHeader icon={<Flame className="size-3.5" />} label="Streak" to="/habits" />
        <div className="flex items-baseline gap-2">
          <span className="font-display text-4xl leading-none">{streak}</span>
          <span className="text-xs text-muted-foreground">day{streak === 1 ? "" : "s"} active</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
          Small actions, compounded. Keep the chain alive — one check-in today is enough.
        </p>
      </PanelCard>

      <PanelCard>
        <PanelHeader icon={<Calendar className="size-3.5" />} label="Today" />
        <p className="font-display text-2xl leading-tight">{new Date().toLocaleDateString(undefined, { weekday: "long" })}</p>
        <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</p>
        <Link to="/review" className="mt-3 inline-flex items-center gap-1 text-xs text-foreground/80 hover:text-foreground transition-colors">
          Close the day with a review <ArrowRight className="size-3" />
        </Link>
      </PanelCard>

      <PanelCard>
        <PanelHeader icon={<NotebookPen className="size-3.5" />} label="Quick capture" to="/notes" />
        <Link to="/notes" className="block rounded-xl bg-muted/50 hover:bg-muted px-3 py-3 text-[13px] text-muted-foreground transition-colors">
          Jot a thought, link, or idea before it slips away…
        </Link>
      </PanelCard>
    </>
  );
}

function PanelCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card border border-border/60 p-5 shadow-soft">
      {children}
    </section>
  );
}
function PanelHeader({ icon, label, to }: { icon: React.ReactNode; label: string; to?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {icon} {label}
      </div>
      {to && (
        <Link to={to} className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors">
          Open <ArrowRight className="size-2.5" />
        </Link>
      )}
    </div>
  );
}
