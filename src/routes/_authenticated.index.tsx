import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Flame, CheckCircle2, NotebookPen, Target, Timer, Sparkles, Sun, Heart, Wallet } from "lucide-react";
import { PowerMeter } from "@/components/power-meter";
import { HabitAnalytics } from "@/components/habit-analytics";
import { InsightsPanel } from "@/components/insights-panel";

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
      const { data, error } = await supabase.from("habit_logs").select("habit_id").eq("date", today).order("date");
      if (error) throw error;
      return data;
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

  const tasks = tasksQ.data ?? [];
  const habits = habitsQ.data ?? [];
  const logsToday = logsQ.data ?? [];

  const open = tasks.filter(t => !t.completed);
  const doneCount = tasks.length - open.length;

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const name = profileQ.data?.display_name ? `, ${profileQ.data.display_name.split(" ")[0]}` : "";
  const dateStr = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const habitsDone = logsToday.length;
  const dailyScore = Math.min(
    100,
    Math.round(((doneCount * 12) + (habitsDone * 18)) / Math.max(1, 1))
  );

  return (
    <AppShell subtitle={dateStr} title={`${greeting}${name}.`} rightPanel={<InsightsPanel />}>
      {profileQ.data?.vision && (
        <p className="text-muted-foreground text-[15px] md:text-base leading-relaxed italic -mt-2 mb-8 font-display">
          "{profileQ.data.vision}"
        </p>
      )}

      {/* Top row: power meter + score / quick actions */}
      <div className="grid gap-5 lg:gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] mb-6 lg:mb-8">
        <PowerMeter />

        <div className="rounded-3xl bg-card border border-border/60 p-5 lg:p-6 shadow-soft flex flex-col">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Daily score</p>
          <div className="flex items-end gap-3 mt-1">
            <span className="font-display text-5xl lg:text-6xl leading-none">{dailyScore}</span>
            <span className="text-xs text-muted-foreground pb-2">/ 100</span>
          </div>
          <div className="mt-4 h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-gradient-to-r from-accent/70 to-accent transition-[width] duration-700 ease-out" style={{ width: `${dailyScore}%` }} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <Quick to="/focus" label="Focus" icon={Timer} />
            <Quick to="/goals" label="Goals" icon={Target} />
            <Quick to="/assistant" label="Ask AI" icon={Sparkles} />
            <Quick to="/review" label="Review" icon={Sun} />
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-8 stagger">
        <Stat label="Open tasks" value={open.length} />
        <Stat label="Completed" value={doneCount} />
        <Stat label="Habits done" value={`${habitsDone}/${habits.length || 0}`} />
        <Stat label="Streak" value={`${habitsDone === habits.length && habits.length > 0 ? "✓" : "—"}`} />
      </div>

      {/* Two column on lg+: Tasks | Habits */}
      <div className="grid gap-5 lg:gap-6 lg:grid-cols-2 mb-6 lg:mb-8">
        <Section title="Focus today" to="/tasks" cta="All tasks">
          {open.length === 0 ? (
            <Empty icon={<CheckCircle2 className="size-5" />} text="Nothing on your plate. Add a task to begin." />
          ) : (
            <ul className="divide-y divide-border/60">
              {open.slice(0, 6).map(t => (
                <li key={t.id} className="py-3 flex items-center gap-3">
                  <span className="size-5 rounded-full border-2 border-border shrink-0" />
                  <span className="text-[15px] truncate">{t.title}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Habits" to="/habits" cta="Track">
          {habits.length === 0 ? (
            <Empty icon={<Flame className="size-5" />} text="No habits yet. Start small — one habit is enough." />
          ) : (
            <ul className="space-y-2">
              {habits.slice(0, 5).map(h => {
                const done = logsToday.some(l => l.habit_id === h.id);
                return (
                  <li key={h.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
                    <span className="text-sm truncate pr-3">{h.name}</span>
                    <span className={`text-[11px] uppercase tracking-wider ${done ? "text-accent" : "text-muted-foreground"}`}>
                      {done ? "Done" : "Pending"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      {/* Body / Health */}
      <HealthWidget />

      {/* Analytics + capture */}
      <div className="grid gap-5 lg:gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] mb-6">
        <HabitAnalytics />

        <Section title="Capture" to="/notes" cta="Notes">
          <Empty icon={<NotebookPen className="size-5" />} text="Jot down a thought, link, or idea before it slips away." />
        </Section>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface border border-border/60 px-4 py-5 shadow-soft hover:border-border transition-colors">
      <div className="font-display text-3xl lg:text-4xl">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1.5">{label}</div>
    </div>
  );
}

function Quick({ to, label, icon: Icon }: { to: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Link to={to} className="group rounded-xl bg-muted/40 hover:bg-muted border border-transparent hover:border-border/60 px-3 py-3 flex items-center gap-2.5 transition-all tap-scale">
      <Icon className="size-4 text-accent" />
      <span className="text-[13px] font-medium">{label}</span>
      <ArrowRight className="size-3 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

function Section({ title, to, cta, children }: { title: string; to: string; cta: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="font-display text-xl lg:text-2xl">{title}</h2>
        <Link to={to} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors">
          {cta} <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="flex-1 rounded-2xl bg-card border border-border/60 px-4 py-2 shadow-soft">
        {children}
      </div>
    </section>
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
