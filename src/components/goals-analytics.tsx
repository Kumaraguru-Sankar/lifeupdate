import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { bucketKey, bucketsFor, rangeFor, type Period } from "@/lib/period";
import { Bars } from "@/components/charts/sparkline";

export function GoalsAnalytics({ period }: { period: Period }) {
  const r = rangeFor(period);

  const { data: goals = [] } = useQuery({
    queryKey: ["goals_analytics", r.from, r.to],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("id,completed,progress,updated_at,created_at");
      if (error) throw error;
      return (data ?? []) as { id: string; completed: boolean; progress: number; updated_at: string; created_at: string }[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks_analytics", r.from, r.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks").select("id,completed,updated_at")
        .eq("completed", true)
        .gte("updated_at", r.from).lt("updated_at", r.to);
      if (error) throw error;
      return (data ?? []) as { id: string; updated_at: string }[];
    },
  });

  const { keys, label } = bucketsFor(period);
  const counts = keys.map(k => tasks.filter(t => bucketKey(t.updated_at.slice(0, 10), period) === k).length);

  const inPeriod = (iso: string) => iso.slice(0, 10) >= r.from && iso.slice(0, 10) < r.to;
  const achieved = goals.filter(g => g.completed && inPeriod(g.updated_at)).length;
  const active = goals.filter(g => !g.completed).length;
  const successRate = goals.length ? Math.round((goals.filter(g => g.completed).length / goals.length) * 100) : 0;
  const perDay = r.days > 0 ? Math.round((tasks.length / Math.min(r.days, 3650)) * 10) / 10 : 0;

  return (
    <section className="nb-card p-5 space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Tasks done" value={String(tasks.length)} sub={`${perDay}/day`} />
        <Stat label="Goals achieved" value={String(achieved)} sub="this period" />
        <Stat label="Active goals" value={String(active)} sub="in progress" />
        <Stat label="Success rate" value={`${successRate}%`} sub="all time" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-black mb-2">Productivity</p>
        <Bars values={counts} labels={keys.map(k => label(k).split(" ")[0])} height={90} color="var(--nb-blue, #6EC1FF)" />
      </div>
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
