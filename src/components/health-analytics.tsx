import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { bucketKey, bucketsFor, rangeFor, type Period } from "@/lib/period";
import { Sparkline } from "@/components/charts/sparkline";

type Log = {
  log_date: string; steps: number | null; sleep_hours: number | null;
  water_glasses: number | null; workout_min: number | null; calories_burned: number | null;
};

export function HealthAnalytics({ period }: { period: Period }) {
  const r = rangeFor(period);

  const { data: logs = [] } = useQuery({
    queryKey: ["health_analytics", r.from, r.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_logs")
        .select("log_date,steps,sleep_hours,water_glasses,workout_min,calories_burned")
        .gte("log_date", r.from).lt("log_date", r.to)
        .order("log_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Log[];
    },
  });

  const { data: weights = [] } = useQuery({
    queryKey: ["weight_analytics", r.from, r.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weight_logs").select("log_date,weight_kg")
        .gte("log_date", r.from).lt("log_date", r.to)
        .order("log_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as { log_date: string; weight_kg: number }[];
    },
  });

  const { keys } = bucketsFor(period);
  const series = (pick: (l: Log) => number) =>
    keys.map(k => {
      const rows = logs.filter(l => bucketKey(l.log_date, period) === k);
      if (!rows.length) return 0;
      return rows.reduce((a, l) => a + pick(l), 0) / rows.length;
    });

  const num = (v: unknown) => Number(v ?? 0) || 0;
  const metrics = [
    { label: "Steps", values: series(l => num(l.steps)), unit: "", color: "var(--nb-blue, #6EC1FF)" },
    { label: "Sleep", values: series(l => num(l.sleep_hours)), unit: "h", color: "var(--nb-lilac, #B8A6FF)" },
    { label: "Water", values: series(l => num(l.water_glasses)), unit: " gl", color: "var(--nb-blue, #6EC1FF)" },
    { label: "Workout", values: series(l => num(l.workout_min)), unit: "m", color: "var(--nb-orange, #FF9F5A)" },
    { label: "Burned", values: series(l => num(l.calories_burned)), unit: " kcal", color: "var(--nb-pink, #FF8FB1)" },
  ];

  const avg = (vals: number[]) => {
    const nz = vals.filter(v => v > 0);
    return nz.length ? nz.reduce((a, b) => a + b, 0) / nz.length : 0;
  };

  const weightVals = weights.map(w => Number(w.weight_kg));
  const weightDelta = weightVals.length > 1 ? weightVals[weightVals.length - 1] - weightVals[0] : 0;

  return (
    <section className="nb-card p-5 space-y-5">
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-black">Analytics</p>
        <h3 className="font-display text-2xl font-black">Your trends</h3>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(m => (
          <div key={m.label} className="rounded-2xl border-[2px] border-[var(--nb-ink)] p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">{m.label}</span>
              <span className="font-display text-lg font-black">
                {Math.round(avg(m.values) * 10) / 10}{m.unit}
              </span>
            </div>
            <Sparkline values={m.values} color={m.color} fill height={44} />
            <p className="text-[9px] text-muted-foreground font-bold mt-1">
              Best {Math.round(Math.max(0, ...m.values))}{m.unit}
            </p>
          </div>
        ))}

        <div className="rounded-2xl border-[2px] border-[var(--nb-ink)] p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Weight</span>
            <span className="font-display text-lg font-black">
              {weightVals.length ? `${weightVals[weightVals.length - 1]}kg` : "—"}
            </span>
          </div>
          <Sparkline values={weightVals} color="var(--nb-green, #7BD389)" fill height={44} />
          <p className="text-[9px] text-muted-foreground font-bold mt-1">
            {weightVals.length > 1 ? `${weightDelta > 0 ? "+" : ""}${Math.round(weightDelta * 10) / 10}kg this period` : "Log more to see a trend"}
          </p>
        </div>
      </div>

      {logs.length === 0 && (
        <p className="text-xs text-muted-foreground font-bold">No health data logged in this period yet.</p>
      )}
    </section>
  );
}
