import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export function HabitAnalytics() {
  const since = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  }, []);

  const { data: logs = [] } = useQuery({
    queryKey: ["habit_logs", "analytics-30", since],
    queryFn: async () => {
      const { data, error } = await supabase.from("habit_logs").select("date").gte("date", since);
      if (error) throw error;
      return data as { date: string }[];
    },
  });

  const days = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });
  const counts = days.map(d => logs.filter(l => l.date === d).length);
  const max = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);
  const active = counts.filter(c => c > 0).length;
  const consistency = Math.round((active / 30) * 100);

  return (
    <section className="rounded-2xl bg-card border border-border/60 p-5 mb-6">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Last 30 days</p>
          <p className="font-display text-2xl mt-1">{total} check-ins</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Consistency</p>
          <p className="font-display text-2xl mt-1">{consistency}%</p>
        </div>
      </div>
      <div className="flex items-end gap-[3px] h-20">
        {counts.map((c, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-accent/80 transition-all duration-700 ease-out-soft"
            style={{ height: `${Math.max(4, (c / max) * 100)}%`, opacity: c === 0 ? 0.15 : 0.4 + (c / max) * 0.6 }}
            title={`${days[i]}: ${c}`}
          />
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 tracking-wide">{days[0].slice(5)} → {days[29].slice(5)}</p>
    </section>
  );
}
