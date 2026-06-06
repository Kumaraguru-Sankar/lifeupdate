import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/hooks/use-period";
import { PeriodPicker } from "@/components/period-picker";
import { rangeFor, previousRange, bucketsFor, bucketKey } from "@/lib/period";
import { Sparkline, Bars } from "@/components/charts/sparkline";
import { Heart, Wallet, Target, Flame, TrendingDown, TrendingUp, Printer } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
  errorComponent: ({ reset }: { error: Error; reset: () => void }) => (
    <AppShell title="Reports" subtitle="Life Analytics">
      <div className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow p-6 text-center">
        <p className="text-sm text-muted-foreground mb-3">Couldn't load reports.</p>
        <button onClick={reset} className="rounded-xl bg-[var(--nb-ink)] text-white px-4 py-2 text-sm font-bold">Try again</button>
      </div>
    </AppShell>
  ),
});

const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fmtMoney = (n: number) => {
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n); }
  catch { return `₹${Math.round(n).toLocaleString()}`; }
};

function ReportsPage() {
  const [period, setPeriod] = usePeriod("reports", { preset: "30d" });
  const r = rangeFor(period);
  const prev = previousRange(period);

  const healthQ = useQuery({
    queryKey: ["report_health", r.from, r.to],
    queryFn: async () => {
      const { data } = await supabase.from("health_logs").select("*").gte("log_date", r.from).lt("log_date", r.to);
      return data ?? [];
    },
  });
  const txQ = useQuery({
    queryKey: ["report_tx", r.from, r.to],
    queryFn: async () => {
      const [{ data: tx }, { data: exp }, { data: inc }] = await Promise.all([
        supabase.from("transactions" as any).select("*").gte("occurred_on", r.from).lt("occurred_on", r.to),
        supabase.from("expenses").select("amount,spent_on,category").gte("spent_on", r.from).lt("spent_on", r.to),
        supabase.from("incomes").select("amount,received_on,source").gte("received_on", r.from).lt("received_on", r.to),
      ]);
      return { tx: tx ?? [], exp: exp ?? [], inc: inc ?? [] };
    },
  });
  const goalsQ = useQuery({
    queryKey: ["report_goals", r.from, r.to],
    queryFn: async () => {
      const { data } = await supabase.from("goals").select("*");
      return data ?? [];
    },
  });
  const habitsQ = useQuery({
    queryKey: ["report_habits", r.from, r.to],
    queryFn: async () => {
      const [{ data: habits }, { data: logs }] = await Promise.all([
        supabase.from("habits").select("id,name"),
        supabase.from("habit_logs").select("habit_id,date").gte("date", r.from).lt("date", r.to),
      ]);
      return { habits: habits ?? [], logs: logs ?? [] };
    },
  });
  const prevTxQ = useQuery({
    queryKey: ["report_tx_prev", prev.from, prev.to],
    queryFn: async () => {
      const [{ data: tx }, { data: exp }, { data: inc }] = await Promise.all([
        supabase.from("transactions" as any).select("type,amount,occurred_on").gte("occurred_on", prev.from).lt("occurred_on", prev.to),
        supabase.from("expenses").select("amount").gte("spent_on", prev.from).lt("spent_on", prev.to),
        supabase.from("incomes").select("amount").gte("received_on", prev.from).lt("received_on", prev.to),
      ]);
      return { tx: tx ?? [], exp: exp ?? [], inc: inc ?? [] };
    },
  });

  // Aggregations
  const buckets = bucketsFor(period);
  const health = healthQ.data ?? [];
  const stepsAvg = health.length ? Math.round(health.reduce((s, h: any) => s + num(h.steps), 0) / health.length) : 0;
  const sleepAvg = health.length ? (health.reduce((s, h: any) => s + num(h.sleep_hours), 0) / health.length) : 0;
  const waterAvg = health.length ? (health.reduce((s, h: any) => s + num(h.water_glasses), 0) / health.length) : 0;
  const stepsByBucket = useMemo(() => {
    const m = new Map(buckets.keys.map(k => [k, 0]));
    for (const h of health as any[]) {
      const k = bucketKey(h.log_date, period);
      if (m.has(k)) m.set(k, (m.get(k) || 0) + num(h.steps));
    }
    return buckets.keys.map(k => m.get(k) || 0);
  }, [health, buckets, period]);

  const allIncome = [...(txQ.data?.tx ?? []).filter((t: any) => t.type === "income").map((t: any) => ({ amt: num(t.amount), d: t.occurred_on })),
                    ...(txQ.data?.inc ?? []).map((i: any) => ({ amt: num(i.amount), d: i.received_on }))];
  const allExpense = [...(txQ.data?.tx ?? []).filter((t: any) => t.type === "expense").map((t: any) => ({ amt: num(t.amount), d: t.occurred_on })),
                      ...(txQ.data?.exp ?? []).map((e: any) => ({ amt: num(e.amount), d: e.spent_on }))];
  const income = allIncome.reduce((s, x) => s + x.amt, 0);
  const expense = allExpense.reduce((s, x) => s + x.amt, 0);

  const prevIncome = [...(prevTxQ.data?.tx ?? []).filter((t: any) => t.type === "income").map((t: any) => num(t.amount)),
                      ...(prevTxQ.data?.inc ?? []).map((i: any) => num(i.amount))].reduce((s, x) => s + x, 0);
  const prevExpense = [...(prevTxQ.data?.tx ?? []).filter((t: any) => t.type === "expense").map((t: any) => num(t.amount)),
                       ...(prevTxQ.data?.exp ?? []).map((e: any) => num(e.amount))].reduce((s, x) => s + x, 0);

  const expenseByBucket = useMemo(() => {
    const m = new Map(buckets.keys.map(k => [k, 0]));
    for (const x of allExpense) {
      const k = bucketKey(x.d, period);
      if (m.has(k)) m.set(k, (m.get(k) || 0) + x.amt);
    }
    return buckets.keys.map(k => m.get(k) || 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txQ.data, buckets, period]);

  const completedGoals = (goalsQ.data ?? []).filter((g: any) => g.completed && g.updated_at >= r.from && g.updated_at < r.to).length;
  const activeGoals = (goalsQ.data ?? []).filter((g: any) => !g.completed).length;

  const habitLogs = habitsQ.data?.logs ?? [];
  const habitCount = habitsQ.data?.habits?.length ?? 0;
  const habitRate = habitCount && r.days ? Math.round((habitLogs.length / (habitCount * r.days)) * 100) : 0;
  const habitsByBucket = useMemo(() => {
    const m = new Map(buckets.keys.map(k => [k, 0]));
    for (const l of habitLogs as any[]) {
      const k = bucketKey(l.date, period);
      if (m.has(k)) m.set(k, (m.get(k) || 0) + 1);
    }
    return buckets.keys.map(k => m.get(k) || 0);
  }, [habitLogs, buckets, period]);

  const delta = (curr: number, prevV: number) => prevV === 0 ? (curr > 0 ? 100 : 0) : ((curr - prevV) / Math.abs(prevV)) * 100;

  return (
    <AppShell title="Reports" subtitle="Life Analytics" action={
      <button onClick={() => window.print()} className="hidden md:inline-flex items-center gap-1.5 rounded-xl bg-[var(--nb-ink)] text-white px-3 py-2 text-xs font-black border-[2.5px] border-[var(--nb-ink)] nb-shadow tap-scale">
        <Printer className="size-3.5" /> Print
      </button>
    }>
      <PeriodPicker value={period} onChange={setPeriod} />

      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-black mt-4 mb-2 px-0.5">
        {r.from} → {new Date(new Date(r.to).getTime() - 86400000).toISOString().slice(0, 10)}
      </p>

      <Section title="Health" icon={Heart} tint="var(--nb-green)">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Stat label="Avg steps" value={stepsAvg.toLocaleString()} />
          <Stat label="Avg sleep" value={`${sleepAvg.toFixed(1)}h`} />
          <Stat label="Avg water" value={`${waterAvg.toFixed(1)}`} />
        </div>
        <Sparkline values={stepsByBucket} fill color="var(--nb-green)" />
      </Section>

      <Section title="Finance" icon={Wallet} tint="var(--nb-yellow)">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Stat label="Income" value={fmtMoney(income)} sub={`${formatDelta(delta(income, prevIncome))} vs prev`} positive={income >= prevIncome} />
          <Stat label="Spending" value={fmtMoney(expense)} sub={`${formatDelta(delta(expense, prevExpense))} vs prev`} positive={expense <= prevExpense} />
          <Stat label="Net" value={fmtMoney(income - expense)} />
        </div>
        <Bars values={expenseByBucket} color="var(--nb-pink)" />
      </Section>

      <Section title="Goals" icon={Target} tint="var(--nb-orange)">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Completed in period" value={String(completedGoals)} />
          <Stat label="Active goals" value={String(activeGoals)} />
        </div>
      </Section>

      <Section title="Habits" icon={Flame} tint="var(--nb-blue)">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Stat label="Consistency" value={`${habitRate}%`} />
          <Stat label="Total check-ins" value={String(habitLogs.length)} />
        </div>
        <Bars values={habitsByBucket} color="var(--nb-blue)" />
      </Section>
    </AppShell>
  );
}

function Section({ title, icon: Icon, tint, children }: { title: string; icon: any; tint: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="font-display text-xl mb-2 inline-flex items-center gap-2">
        <span className="grid place-items-center size-7 rounded-lg border-[2.5px] border-[var(--nb-ink)]" style={{ background: tint }}>
          <Icon className="size-3.5" strokeWidth={2.8} />
        </span>
        {title}
      </h2>
      <div className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow p-4">
        {children}
      </div>
    </section>
  );
}

function Stat({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="rounded-xl bg-background border-[2px] border-[var(--nb-ink)] p-2.5">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">{label}</div>
      <div className="font-display text-base leading-tight mt-0.5 truncate">{value}</div>
      {sub && (
        <div className={`text-[10px] font-bold mt-0.5 inline-flex items-center gap-0.5 ${positive ? "text-[var(--nb-green)]" : "text-[var(--nb-pink)]"}`}>
          {positive ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
          {sub}
        </div>
      )}
    </div>
  );
}

function formatDelta(d: number) {
  if (!Number.isFinite(d)) return "—";
  return `${d >= 0 ? "+" : ""}${d.toFixed(0)}%`;
}
