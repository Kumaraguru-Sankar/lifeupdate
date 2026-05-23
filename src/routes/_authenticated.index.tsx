import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Flame, CheckCircle2, NotebookPen, Target, Timer, Sparkles, Heart, Wallet, Footprints, Droplets, Moon, ArrowRight, Trophy, Zap } from "lucide-react";
import { ProgressRing } from "@/components/progress-ring";
import { useGameStats, motivationOfDay } from "@/lib/gamification";

export const Route = createFileRoute("/_authenticated/")({ component: Today });

function Today() {
  const today = new Date().toISOString().slice(0, 10);

  const tasksQ = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const habitsQ = useQuery({
    queryKey: ["habits"],
    queryFn: async () => {
      const { data, error } = await supabase.from("habits").select("*").order("created_at");
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

  const profileQ = useQuery({
    queryKey: ["profile_today"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("display_name, vision").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const gameQ = useGameStats();

  const tasks = tasksQ.data ?? [];
  const habits = habitsQ.data ?? [];
  const logsToday = logsQ.data ?? [];
  const open = tasks.filter(t => !t.completed);
  const game = gameQ.data;

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const name = profileQ.data?.display_name ? `, ${profileQ.data.display_name.split(" ")[0]}` : "";
  const dateStr = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const stepGoal = stepGoalQ.data ?? 8000;
  const steps = healthQ.data?.steps ?? 0;
  const water = healthQ.data?.water_glasses ?? 0;
  const sleep = Number(healthQ.data?.sleep_hours ?? 0);
  const calories = healthQ.data?.calories_burned ?? 0;
  const habitsDone = logsToday.length;
  const habitsTotal = habits.length || 0;

  return (
    <AppShell subtitle={dateStr} title={`${greeting}${name}.`}>
      {/* Motivation strip */}
      <p className="text-muted-foreground text-[15px] md:text-base italic -mt-1 mb-6 font-display">
        "{motivationOfDay()}"
      </p>

      {/* HERO: level + streak + today score (Go Club style) */}
      <section className="rounded-[28px] bg-grad-sky text-white p-5 md:p-7 shadow-pop relative overflow-hidden pop-in mb-6">
        <div aria-hidden className="absolute -top-10 -right-10 size-48 rounded-full bg-white/15 blur-2xl" />
        <div aria-hidden className="absolute -bottom-16 -left-10 size-56 rounded-full bg-white/10 blur-2xl" />

        <div className="relative grid grid-cols-[1fr_auto] gap-4 items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/80">
              <Trophy className="size-3.5" /> Level {game?.level ?? 1}
            </div>
            <div className="font-display text-4xl md:text-5xl mt-1 leading-none drop-shadow-sm">
              {game?.todayScore ?? 0}<span className="text-white/70 text-2xl"> / 100</span>
            </div>
            <p className="text-white/85 text-sm mt-1">Today's energy score</p>

            <div className="mt-4 h-2.5 w-full rounded-full bg-white/20 overflow-hidden">
              <div className="h-full bg-white rounded-full transition-[width] duration-1000 ease-out" style={{ width: `${game?.todayScore ?? 0}%` }} />
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs text-white/85">
              <span className="inline-flex items-center gap-1.5"><Zap className="size-3.5" /> {game?.xp ?? 0} XP</span>
              <span className="inline-flex items-center gap-1.5"><Flame className="size-3.5" /> {game?.streak ?? 0}-day streak</span>
            </div>
          </div>

          <div className="shrink-0">
            <ProgressRing
              value={game ? game.progress * 100 : 0}
              size={108}
              stroke={10}
              trackClass="stroke-white/25"
              gradFrom="#ffffff"
              gradTo="#ffffff"
            >
              <div className="text-center">
                <div className="font-display text-2xl leading-none text-white">L{game?.level ?? 1}</div>
                <div className="text-[10px] uppercase tracking-widest text-white/80 mt-1">{game?.xpInLevel ?? 0}/{game?.xpForNextLevel ?? 200}</div>
              </div>
            </ProgressRing>
          </div>
        </div>

        {/* Badges */}
        {game && game.badges.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2 relative">
            {game.badges.slice(0, 4).map(b => (
              <span key={b} className="px-3 py-1 rounded-full bg-white/20 text-white text-[11px] font-medium backdrop-blur-sm">{b}</span>
            ))}
          </div>
        )}
      </section>

      {/* WELLNESS RINGS — Go Club hero */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 stagger">
        <WellnessRing
          to="/health"
          label="Steps"
          value={steps}
          unit=""
          target={stepGoal}
          icon={Footprints}
          gradFrom="var(--c-mint)"
          gradTo="var(--c-sky)"
          tint="bg-grad-mint"
        />
        <WellnessRing
          to="/health"
          label="Water"
          value={water}
          unit="cups"
          target={8}
          icon={Droplets}
          gradFrom="var(--c-sky)"
          gradTo="var(--c-lilac)"
          tint="bg-grad-sky"
        />
        <WellnessRing
          to="/health"
          label="Calories"
          value={calories}
          unit="kcal"
          target={500}
          icon={Flame}
          gradFrom="var(--c-peach)"
          gradTo="var(--c-blush)"
          tint="bg-grad-peach"
        />
        <WellnessRing
          to="/health"
          label="Sleep"
          value={sleep}
          unit="h"
          target={8}
          icon={Moon}
          gradFrom="var(--c-lilac)"
          gradTo="var(--c-sky)"
          tint="bg-grad-lilac"
        />
      </section>

      {/* Quick actions — cozy chips */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-7 stagger">
        <ChipAction to="/focus" label="Focus" icon={Timer} tint="bg-grad-mint" />
        <ChipAction to="/goals" label="Goals" icon={Target} tint="bg-grad-lilac" />
        <ChipAction to="/assistant" label="Ask AI" icon={Sparkles} tint="bg-grad-sky" />
        <ChipAction to="/journal" label="Reflect" icon={NotebookPen} tint="bg-grad-peach" />
      </section>

      {/* Today's missions — tasks as gamified missions */}
      <div className="grid gap-5 lg:grid-cols-2 mb-6">
        <CozyCard title="Today's missions" linkTo="/tasks" cta="All tasks" tint="bg-grad-mint">
          {open.length === 0 ? (
            <Empty icon={<CheckCircle2 className="size-5" />} text="All clear. Add a tiny mission to start your streak." />
          ) : (
            <ul className="space-y-2">
              {open.slice(0, 5).map((t, i) => (
                <li key={t.id} className="flex items-center gap-3 rounded-2xl bg-background/60 px-4 py-3 border border-border/40 lift">
                  <span className="grid place-items-center size-7 rounded-full bg-grad-mint text-white text-[11px] font-semibold shadow-soft">+{(i % 3) * 4 + 8}</span>
                  <span className="text-[14px] truncate flex-1">{t.title}</span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">XP</span>
                </li>
              ))}
            </ul>
          )}
        </CozyCard>

        <CozyCard title="Daily habits" linkTo="/habits" cta="Track" tint="bg-grad-lilac">
          {habits.length === 0 ? (
            <Empty icon={<Flame className="size-5" />} text="No habits yet. One tiny one is enough to begin." />
          ) : (
            <ul className="space-y-2">
              {habits.slice(0, 5).map(h => {
                const done = logsToday.some(l => l.habit_id === h.id);
                return (
                  <li key={h.id} className={`flex items-center justify-between rounded-2xl px-4 py-3 border transition-all ${done ? "bg-grad-mint border-transparent text-white shadow-soft" : "bg-background/60 border-border/40"}`}>
                    <span className="text-sm truncate pr-3">{h.name}</span>
                    <span className={`text-[11px] uppercase tracking-wider ${done ? "text-white" : "text-muted-foreground"}`}>
                      {done ? "✓ Done" : "Pending"}
                    </span>
                  </li>
                );
              })}
              <li className="text-[11px] text-muted-foreground text-center pt-1">
                {habitsDone}/{habitsTotal} today
              </li>
            </ul>
          )}
        </CozyCard>
      </div>

      {/* Wellness + money quick links */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <SoftLink to="/health" title="Health" subtitle="Steps, sleep, nutrition, BMI" icon={Heart} tint="bg-grad-peach" />
        <SoftLink to="/finance" title="Finance" subtitle="Income, spending, subscriptions" icon={Wallet} tint="bg-grad-sun" />
      </div>
    </AppShell>
  );
}

function WellnessRing({
  to, label, value, unit, target, icon: Icon, gradFrom, gradTo, tint,
}: {
  to: string; label: string; value: number; unit: string; target: number;
  icon: React.ComponentType<{ className?: string }>;
  gradFrom: string; gradTo: string; tint: string;
}) {
  const pct = Math.max(0, Math.min(100, target > 0 ? (value / target) * 100 : 0));
  return (
    <Link to={to} className="group rounded-3xl bg-card border border-border/50 p-4 md:p-5 shadow-soft lift flex flex-col items-center gap-2 tap-scale">
      <div className="relative">
        <ProgressRing value={pct} size={92} stroke={9} gradFrom={gradFrom} gradTo={gradTo}>
          <div className={`size-10 rounded-full ${tint} grid place-items-center text-white shadow-soft`}>
            <Icon className="size-4" />
          </div>
        </ProgressRing>
      </div>
      <div className="text-center">
        <div className="font-display text-xl leading-none">{Number(value).toLocaleString()}<span className="text-xs text-muted-foreground font-sans"> {unit}</span></div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
      </div>
    </Link>
  );
}

function ChipAction({ to, label, icon: Icon, tint }: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; tint: string }) {
  return (
    <Link to={to} className="group rounded-2xl bg-card border border-border/50 px-3 py-3 flex items-center gap-3 shadow-soft lift tap-scale">
      <span className={`grid place-items-center size-9 rounded-xl ${tint} text-white shadow-soft`}>
        <Icon className="size-4" />
      </span>
      <span className="text-sm font-medium">{label}</span>
      <ArrowRight className="size-3.5 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

function CozyCard({ title, linkTo, cta, tint, children }: { title: string; linkTo: string; cta: string; tint: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="font-display text-2xl tracking-tight inline-flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${tint}`} />
          {title}
        </h2>
        <Link to={linkTo} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors">
          {cta} <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="flex-1 rounded-3xl bg-card/80 border border-border/50 p-3 md:p-4 shadow-soft">
        {children}
      </div>
    </section>
  );
}

function SoftLink({ to, title, subtitle, icon: Icon, tint }: { to: string; title: string; subtitle: string; icon: React.ComponentType<{ className?: string }>; tint: string }) {
  return (
    <Link to={to} className={`group rounded-3xl ${tint} text-white p-5 md:p-6 shadow-pop lift relative overflow-hidden tap-scale`}>
      <div aria-hidden className="absolute -top-8 -right-8 size-32 rounded-full bg-white/20 blur-2xl" />
      <div className="flex items-center justify-between mb-2 relative">
        <span className="text-[10px] uppercase tracking-[0.22em] text-white/80">{subtitle}</span>
        <Icon className="size-5 text-white/90" />
      </div>
      <h2 className="font-display text-3xl relative">{title}</h2>
      <span className="text-xs text-white/90 inline-flex items-center gap-1 mt-3 relative">Open <ArrowRight className="size-3" /></span>
    </Link>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="py-6 flex items-center gap-3 text-muted-foreground">
      <span className="grid place-items-center size-9 rounded-full bg-muted">{icon}</span>
      <p className="text-sm">{text}</p>
    </div>
  );
}
