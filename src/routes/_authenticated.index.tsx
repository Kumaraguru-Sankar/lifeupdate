import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Flame, Target, Heart, Wallet, Footprints, Droplets, Moon, ArrowRight, Trophy, Zap, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import { ProgressRing } from "@/components/progress-ring";
import { useGameStats, motivationOfDay } from "@/lib/gamification";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({ component: Home });

function Home() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(); monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  const habitsQ = useQuery({
    queryKey: ["habits"],
    queryFn: async () => {
      const { data, error } = await supabase.from("habits").select("*").order("sort_order").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const logsQ = useQuery({
    queryKey: ["habit_logs", today],
    queryFn: async () => {
      const { data, error } = await supabase.from("habit_logs").select("habit_id").eq("date", today);
      if (error) throw error;
      return data;
    },
  });

  const healthQ = useQuery({
    queryKey: ["health_today", today],
    queryFn: async () => {
      const { data } = await supabase.from("health_logs").select("*").eq("log_date", today).maybeSingle();
      return data;
    },
  });

  const stepGoalQ = useQuery({
    queryKey: ["step_goal"],
    queryFn: async () => {
      const { data } = await supabase.from("step_goals").select("daily_target").maybeSingle();
      return data?.daily_target ?? 8000;
    },
  });

  const goalsQ = useQuery({
    queryKey: ["goals_home"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("id,title,progress,completed,target_date").eq("completed", false).order("sort_order").limit(3);
      if (error) throw error;
      return data;
    },
  });

  const incomeQ = useQuery({
    queryKey: ["income_month", monthStartStr],
    queryFn: async () => {
      const { data, error } = await supabase.from("incomes").select("amount").gte("received_on", monthStartStr);
      if (error) throw error;
      return (data ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
    },
  });

  const expenseQ = useQuery({
    queryKey: ["expenses_month", monthStartStr],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("amount").gte("spent_on", monthStartStr);
      if (error) throw error;
      return (data ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
    },
  });

  const profileQ = useQuery({
    queryKey: ["profile_today"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const gameQ = useGameStats();

  const habits = habitsQ.data ?? [];
  const logsToday = logsQ.data ?? [];
  const goals = goalsQ.data ?? [];
  const game = gameQ.data;

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const name = profileQ.data?.display_name ? `, ${profileQ.data.display_name.split(" ")[0]}` : "";
  const dateStr = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const stepGoal = stepGoalQ.data ?? 8000;
  const steps = healthQ.data?.steps ?? 0;
  const water = healthQ.data?.water_glasses ?? 0;
  const sleep = Number(healthQ.data?.sleep_hours ?? 0);

  const income = incomeQ.data ?? 0;
  const expenses = expenseQ.data ?? 0;
  const net = income - expenses;

  return (
    <AppShell subtitle={dateStr} title={`${greeting}${name}.`}>
      <p className="text-muted-foreground text-[15px] italic -mt-1 mb-6 font-display">"{motivationOfDay()}"</p>

      {/* 1. XP / Level / Streak hero */}
      <section className="rounded-2xl bg-[var(--nb-ink)] text-white border-[3px] border-[var(--nb-ink)] nb-shadow-lg p-5 md:p-6 mb-5 relative overflow-hidden">
        <div className="relative grid grid-cols-[1fr_auto] gap-4 items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--nb-yellow)] font-black">
              <Trophy className="size-3.5" /> Level {game?.level ?? 1}
            </div>
            <div className="font-display text-5xl mt-1 leading-none">
              {game?.todayScore ?? 0}<span className="text-white/50 text-2xl"> / 100</span>
            </div>
            <p className="text-white/80 text-sm mt-1 font-bold">Today's energy score</p>

            <div className="mt-3 h-3 w-full rounded-full bg-white/15 overflow-hidden border-[2px] border-[var(--nb-ink)]">
              <div className="h-full bg-[var(--nb-yellow)] transition-[width] duration-1000" style={{ width: `${game?.todayScore ?? 0}%` }} />
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--nb-yellow)] text-[var(--nb-ink)] font-black border-[2px] border-[var(--nb-ink)]">
                <Zap className="size-3" strokeWidth={3} /> {game?.xp ?? 0} XP
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--nb-pink)] text-white font-black border-[2px] border-[var(--nb-ink)]">
                <Flame className="size-3" strokeWidth={3} /> {game?.streak ?? 0}-day
              </span>
            </div>
          </div>

          <div className="shrink-0">
            <ProgressRing
              value={game ? game.progress * 100 : 0}
              size={104}
              stroke={10}
              trackClass="stroke-white/20"
              gradFrom="var(--nb-yellow)"
              gradTo="var(--nb-orange)"
            >
              <div className="text-center">
                <div className="font-display text-2xl leading-none text-white">L{game?.level ?? 1}</div>
                <div className="text-[10px] uppercase tracking-widest text-white/70 font-bold mt-1">{game?.xpInLevel ?? 0}/{game?.xpForNextLevel ?? 200}</div>
              </div>
            </ProgressRing>
          </div>
        </div>
      </section>

      {/* 2. Health snapshot */}
      <SectionTitle to="/health" title="Health" tint="bg-[var(--nb-green)]" icon={Heart} />
      <section className="grid grid-cols-4 gap-2.5 mb-6">
        <Metric label="Steps" value={steps.toLocaleString()} pct={(steps / stepGoal) * 100} icon={Footprints} tint="var(--nb-green)" />
        <Metric label="Water" value={`${water}`} unit="cups" pct={(water / 8) * 100} icon={Droplets} tint="var(--nb-blue)" />
        <Metric label="Sleep" value={sleep ? sleep.toFixed(1) : "0"} unit="hr" pct={(sleep / 8) * 100} icon={Moon} tint="var(--nb-pink)" />
        <Metric label="Burn" value={`${healthQ.data?.calories_burned ?? 0}`} unit="kcal" pct={((healthQ.data?.calories_burned ?? 0) / 500) * 100} icon={Flame} tint="var(--nb-orange)" />
      </section>

      {/* 3. Active goals */}
      <SectionTitle to="/goals" title="Active goals" tint="bg-[var(--nb-orange)]" icon={Target} />
      <section className="mb-6">
        {goals.length === 0 ? (
          <EmptyCard text="No active goals. Set one to start making moves." cta="Create a goal" to="/goals" />
        ) : (
          <ul className="space-y-2.5">
            {goals.map(g => (
              <li key={g.id}>
                <Link to="/goals" className="block rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow p-4 tap-scale">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="font-display text-base truncate flex-1">{g.title}</p>
                    <span className="text-sm font-black">{g.progress}<span className="text-muted-foreground text-xs">%</span></span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden border-[1.5px] border-[var(--nb-ink)]">
                    <div className="h-full bg-[var(--nb-orange)]" style={{ width: `${g.progress}%` }} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4. Daily habits */}
      <SectionTitle to="/habits" title="Daily habits" tint="bg-[var(--nb-blue)]" icon={Flame} />
      <section className="mb-6">
        {habits.length === 0 ? (
          <EmptyCard text="No habits yet. Build one tiny habit." cta="Add habit" to="/habits" />
        ) : (
          <div className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow p-3">
            <ul className="space-y-1.5">
              {habits.slice(0, 5).map(h => {
                const done = logsToday.some(l => l.habit_id === h.id);
                return (
                  <li key={h.id} className={cn("flex items-center justify-between rounded-xl px-3 py-2.5 border-[2px] transition-all",
                    done ? "bg-[var(--nb-green)]/20 border-[var(--nb-ink)]" : "bg-background border-transparent")}>
                    <span className="text-sm font-semibold truncate pr-2">{h.name}</span>
                    {done ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider">
                        <CheckCircle2 className="size-3.5" strokeWidth={3} /> Done
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pending</span>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="text-[11px] text-muted-foreground text-center pt-2 pb-1 font-bold uppercase tracking-wider">
              {logsToday.length}/{habits.length} today
            </div>
          </div>
        )}
      </section>

      {/* 5. Finance snapshot */}
      <SectionTitle to="/finance" title="Finance" tint="bg-[var(--nb-yellow)]" icon={Wallet} />
      <section className="grid grid-cols-3 gap-2.5 mb-4">
        <MoneyCard label="Income" value={income} tint="var(--nb-green)" icon={TrendingUp} />
        <MoneyCard label="Spent" value={expenses} tint="var(--nb-pink)" icon={TrendingDown} />
        <MoneyCard label="Net" value={net} tint={net >= 0 ? "var(--nb-blue)" : "var(--nb-orange)"} icon={Wallet} />
      </section>
    </AppShell>
  );
}

function SectionTitle({ to, title, tint, icon: Icon }: { to: string; title: string; tint: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }) {
  return (
    <div className="flex items-center justify-between mb-2.5 px-0.5">
      <h2 className="font-display text-xl tracking-tight inline-flex items-center gap-2">
        <span className={cn("grid place-items-center size-7 rounded-lg border-[2.5px] border-[var(--nb-ink)]", tint)}>
          <Icon className="size-3.5" strokeWidth={2.8} />
        </span>
        {title}
      </h2>
      <Link to={to} className="text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        Open <ArrowRight className="size-3" strokeWidth={3} />
      </Link>
    </div>
  );
}

function Metric({ label, value, unit, pct, icon: Icon, tint }: { label: string; value: string; unit?: string; pct: number; icon: React.ComponentType<{ className?: string }>; tint: string }) {
  const clamped = Math.max(0, Math.min(100, pct || 0));
  return (
    <div className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow p-2.5 flex flex-col items-center gap-1.5">
      <ProgressRing value={clamped} size={62} stroke={7} gradFrom={tint} gradTo={tint}>
        <Icon className="size-4" />
      </ProgressRing>
      <div className="text-center min-w-0 w-full">
        <div className="font-display text-base leading-none truncate">{value}{unit && <span className="text-[10px] text-muted-foreground font-sans"> {unit}</span>}</div>
        <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5 font-bold">{label}</div>
      </div>
    </div>
  );
}

function MoneyCard({ label, value, tint, icon: Icon }: { label: string; value: number; tint: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }) {
  return (
    <div className="rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</span>
        <span className="grid place-items-center size-6 rounded-md border-[2px] border-[var(--nb-ink)]" style={{ background: tint }}>
          <Icon className="size-3" strokeWidth={3} />
        </span>
      </div>
      <div className="font-display text-lg leading-none truncate">${Math.round(value).toLocaleString()}</div>
    </div>
  );
}

function EmptyCard({ text, cta, to }: { text: string; cta: string; to: string }) {
  return (
    <Link to={to} className="block rounded-2xl bg-card border-[3px] border-dashed border-[var(--nb-ink)] p-5 text-center tap-scale">
      <p className="text-sm text-muted-foreground mb-2">{text}</p>
      <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest">
        {cta} <ArrowRight className="size-3" strokeWidth={3} />
      </span>
    </Link>
  );
}
