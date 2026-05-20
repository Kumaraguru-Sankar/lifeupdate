import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Flame, CheckCircle2, NotebookPen } from "lucide-react";
import { PowerMeter } from "@/components/power-meter";

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

  const tasks = tasksQ.data ?? [];
  const habits = habitsQ.data ?? [];
  const logsToday = logsQ.data ?? [];

  const open = tasks.filter(t => !t.completed);
  const doneCount = tasks.length - open.length;

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <AppShell subtitle={dateStr} title={greeting + "."}>
      <p className="text-muted-foreground text-base leading-relaxed -mt-2 mb-8">
        A calm space to focus on what matters today. Move through your tasks, tend your habits, and capture what's on your mind.
      </p>

      <PowerMeter />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <Stat label="Open tasks" value={open.length} />
        <Stat label="Completed" value={doneCount} />
        <Stat label="Habits done" value={`${logsToday.length}/${habits.length || 0}`} />
      </div>

      <Section title="Focus today" to="/tasks" cta="All tasks">
        {open.length === 0 ? (
          <Empty icon={<CheckCircle2 className="size-5" />} text="Nothing on your plate. Add a task to begin." />
        ) : (
          <ul className="divide-y divide-border/60">
            {open.slice(0, 4).map(t => (
              <li key={t.id} className="py-3 flex items-center gap-3">
                <span className="size-5 rounded-full border-2 border-border" />
                <span className="text-[15px]">{t.title}</span>
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
            {habits.slice(0, 3).map(h => (
              <li key={h.id} className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3">
                <span className="text-sm">{h.name}</span>
                <span className="text-xs text-muted-foreground">
                  {logsToday.some(l => l.habit_id === h.id) ? "Done today" : "Pending"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Capture" to="/notes" cta="Notes">
        <Empty icon={<NotebookPen className="size-5" />} text="Jot down a thought, link, or idea before it slips away." />
      </Section>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface border border-border/60 px-4 py-4">
      <div className="font-display text-3xl">{value}</div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function Section({ title, to, cta, children }: { title: string; to: string; cta: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-xl">{title}</h2>
        <Link to={to} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          {cta} <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="rounded-2xl bg-card border border-border/60 px-4 py-2">
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
