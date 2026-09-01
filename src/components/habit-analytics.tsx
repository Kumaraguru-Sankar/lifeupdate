import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { bucketKey, bucketsFor, rangeFor, previousRange, type Period } from "@/lib/period";
import { Bars } from "@/components/charts/sparkline";

type Habit = { id: string; name: string };

export function HabitAnalytics({ period, habits = [] }: { period: Period; habits?: Habit[] }) {
  const r = rangeFor(period);
  const prev = previousRange(period);

  const { data: logs = [] } = useQuery({
    queryKey: ["habit_logs", "analytics", r.from, r.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_logs").select("habit_id,date")
        .gte("date", r.from).lt("date", r.to);
      if (error) throw error;
      return data as { habit_id: string; date: string }[];
    },
  });

  const { data: prevLogs = [] } = useQuery({
    queryKey: ["habit_logs", "analytics-prev", prev.from, prev.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_logs").select("date")
        .gte("date", prev.from).lt("date", prev.to);
      if (error) throw error;
      return data as { date: string }[];
    },
  });

  const { keys, label } = bucketsFor(period);
  const counts = keys.map(k => logs.filter(l => bucketKey(l.date, period) === k).length);

  const total = logs.length;
  const prevTotal = prevLogs.length;
  const delta = prevTotal === 0 ? (total > 0 ? 100 : 0) : Math.round(((total - prevTotal) / prevTotal) * 100);

  const uniqueDays = new Set(logs.map(l => l.date)).size;
  const spanDays = Math.min(r.days, heatDays(r));
  const consistency = spanDays > 0 ? Math.round((uniqueDays / spanDays) * 100) : 0;

  // per-habit completion %
  const perHabit = habits.map(h => ({
    name: h.name,
    pct: spanDays > 0 ? Math.round((logs.filter(l => l.habit_id === h.id).length / spanDays) * 100) : 0,
  })).sort((a, b) => b.pct - a.pct);

  // heatmap: last up-to-98 days within range
  const heat = heatDates(r).map(d => ({ d, n: logs.filter(l => l.date === d).length }));
  const heatMax = Math.max(1, ...heat.map(h => h.n));

  return (
    <section className="nb-card p-5 mb-6 space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Check-ins" value={String(total)} sub={`${delta >= 0 ? "+" : ""}${delta}% vs prev`} />
        <Stat label="Consistency" value={`${consistency}%`} sub={`${uniqueDays} active days`} />
        <Stat label="Habits" value={String(habits.length)} sub="tracked" />
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-black mb-2">Trend</p>
        <Bars values={counts} labels={keys.map(k => label(k).split(" ")[0])} height={90} color="var(--nb-yellow, #FFD84D)" />
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-black mb-2">Heatmap</p>
        <div className="grid grid-flow-col grid-rows-7 gap-[3px] overflow-x-auto pb-1">
          {heat.map(({ d, n }) => (
            <div
              key={d}
              title={`${d}: ${n}`}
              className="size-3 rounded-[3px] border border-[var(--nb-ink)]/30"
              style={{ background: n === 0 ? "transparent" : `color-mix(in srgb, var(--nb-green, #7BD389) ${20 + (n / heatMax) * 80}%, transparent)` }}
            />
          ))}
        </div>
      </div>

      {perHabit.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-black">Completion rate</p>
          {perHabit.map(h => (
            <div key={h.name} className="flex items-center gap-3">
              <span className="text-xs font-bold truncate w-28">{h.name}</span>
              <div className="flex-1 h-3 rounded-full border-[2px] border-[var(--nb-ink)] overflow-hidden bg-muted">
                <div className="h-full bg-[var(--nb-green,#7BD389)]" style={{ width: `${Math.min(100, h.pct)}%` }} />
              </div>
              <span className="text-xs font-black w-10 text-right">{h.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-black">{label}</p>
      <p className="font-display text-2xl mt-1 font-black">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function heatDays(r: { from: string; to: string; days: number }) {
  return Math.min(r.days, 98);
}

function heatDates(r: { from: string; to: string; days: number }) {
  const to = new Date(r.to);
  const n = heatDays(r);
  const out: string[] = [];
  for (let i = n; i >= 1; i--) {
    const d = new Date(to); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    if (iso >= r.from) out.push(iso);
  }
  return out;
}
