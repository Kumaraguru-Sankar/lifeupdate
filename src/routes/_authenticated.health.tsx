import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Moon, Droplet, Dumbbell, Flame, Apple, Plus, Trash2, Pencil, RotateCcw, Footprints } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar } from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/health")({ component: HealthPage });

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

function HealthPage() {
  return (
    <AppShell title="Health" subtitle="Wellness Operating System">
      <div className="space-y-8">
        <Overview />
        <div className="grid gap-5 lg:grid-cols-2">
          <StepLogger />
          <WaterLogger />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <SleepLogger />
          <WeightTracker />
        </div>
        <WorkoutTracker />
        <Nutrition />
        <div className="grid gap-5 lg:grid-cols-2">
          <BMICalculator />
          <CalorieCalculator />
        </div>
        <WeeklySummary />
      </div>
    </AppShell>
  );
}

/* ---------- helpers ---------- */

function SectionTitle({ children, eyebrow }: { children: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-4">
      {eyebrow && <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-1.5">{eyebrow}</p>}
      <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight">{children}</h2>
    </div>
  );
}

function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-3xl bg-card border border-border/60 shadow-soft p-5 lg:p-6 ${className}`}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return user.id;
}

/** Upsert a partial health_logs patch for today, returns invalidator. */
function useHealthPatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const user_id = await getUserId();
      const date = today();
      const { data: existing } = await supabase.from("health_logs")
        .select("*").eq("user_id", user_id).eq("log_date", date).maybeSingle();
      const row = { user_id, log_date: date, ...(existing ?? {}), ...patch };
      const { error } = await supabase.from("health_logs")
        .upsert(row, { onConflict: "user_id,log_date" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health"] });
      qc.invalidateQueries({ queryKey: ["health_week"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Couldn't save"),
  });
}

/* ---------- Overview ---------- */

function Overview() {
  const date = today();
  const { data: health } = useQuery({
    queryKey: ["health", date],
    queryFn: async () => {
      const { data } = await supabase.from("health_logs").select("*").eq("log_date", date).maybeSingle();
      return data as any;
    },
  });
  const { data: nutrition = [] } = useQuery({
    queryKey: ["nutrition", date],
    queryFn: async () => {
      const { data } = await supabase.from("nutrition_logs").select("calories").eq("log_date", date);
      return (data ?? []) as { calories: number }[];
    },
  });
  const { data: workouts = [] } = useQuery({
    queryKey: ["workouts", date],
    queryFn: async () => {
      const { data } = await supabase.from("workouts").select("calories_burned, duration_min").eq("log_date", date);
      return (data ?? []) as { calories_burned: number; duration_min: number }[];
    },
  });

  const consumed = nutrition.reduce((s, n) => s + (n.calories ?? 0), 0);
  const workoutBurn = workouts.reduce((s, w) => s + (w.calories_burned ?? 0), 0);
  const workoutMin = workouts.reduce((s, w) => s + (w.duration_min ?? 0), 0);
  const burned = (health?.calories_burned ?? 0) + workoutBurn;
  const totalWorkoutMin = (health?.workout_min ?? 0) + workoutMin;

  const score = Math.min(100, Math.round(
    ((health?.steps ?? 0) / 10000) * 25 +
    Math.min(1, (health?.water_glasses ?? 0) / 8) * 25 +
    Math.min(1, (health?.sleep_hours ?? 0) / 8) * 25 +
    Math.min(1, totalWorkoutMin / 30) * 25
  ));

  return (
    <section>
      <SectionTitle eyebrow="Today">Health overview</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ScoreCard score={score} />
        <Metric icon={<Flame className="size-4" />} label="Consumed" value={consumed} suffix=" kcal" />
        <Metric icon={<Activity className="size-4" />} label="Burned" value={burned} suffix=" kcal" />
        <Metric icon={<Flame className="size-4" />} label="Net" value={consumed - burned} suffix=" kcal" tone={consumed - burned > 2500 ? "warn" : "ok"} />
        <Metric icon={<Footprints className="size-4" />} label="Steps" value={(health?.steps ?? 0).toLocaleString()} suffix="" />
        <Metric icon={<Droplet className="size-4" />} label="Water" value={`${((health?.water_glasses ?? 0) * 250 / 1000).toFixed(2)}`} suffix=" L" />
        <Metric icon={<Moon className="size-4" />} label="Sleep" value={Number(health?.sleep_hours ?? 0).toFixed(1)} suffix="h" />
        <Metric icon={<Dumbbell className="size-4" />} label="Workout" value={totalWorkoutMin} suffix="m" />
      </div>
    </section>
  );
}

function ScoreCard({ score }: { score: number }) {
  const r = 42, c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <Card className="flex items-center gap-5 col-span-2 lg:col-span-2 bg-gradient-to-br from-card to-muted/40">
      <svg width="110" height="110" viewBox="0 0 110 110" className="-rotate-90 shrink-0">
        <circle cx="55" cy="55" r={r} className="stroke-muted" strokeWidth="10" fill="none" />
        <circle cx="55" cy="55" r={r} stroke="currentColor" className="text-accent transition-[stroke-dashoffset] duration-700 ease-out" strokeWidth="10" fill="none" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Daily score</p>
        <p className="font-display text-5xl lg:text-6xl leading-none mt-1 font-semibold">{score}</p>
        <p className="text-xs text-muted-foreground mt-2">Steps, water, sleep & workout — balanced.</p>
      </div>
    </Card>
  );
}

function Metric({ icon, label, value, suffix, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; suffix: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-2xl bg-surface border border-border/60 p-4 shadow-soft">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{icon}{label}</div>
      <div className={`mt-1.5 font-display text-3xl leading-none ${tone === "warn" ? "text-destructive" : ""}`}>{value}<span className="text-xs text-muted-foreground">{suffix}</span></div>
    </div>
  );
}

/* ---------- Step logger with quick-add + goal ---------- */

function StepLogger() {
  const qc = useQueryClient();
  const date = today();
  const patch = useHealthPatch();

  const { data: goal } = useQuery({
    queryKey: ["step_goal"],
    queryFn: async () => {
      const user_id = await getUserId();
      const { data } = await supabase.from("step_goals").select("*").eq("user_id", user_id).maybeSingle();
      return data as { daily_target: number } | null;
    },
  });
  const { data: health } = useQuery({
    queryKey: ["health", date],
    queryFn: async () => {
      const { data } = await supabase.from("health_logs").select("steps").eq("log_date", date).maybeSingle();
      return data as { steps: number } | null;
    },
  });
  const { data: weekly = [] } = useQuery({
    queryKey: ["health_week"],
    queryFn: async () => {
      const since = daysAgo(6);
      const { data } = await supabase.from("health_logs").select("log_date, steps").gte("log_date", since).order("log_date");
      return (data ?? []) as { log_date: string; steps: number }[];
    },
  });

  const target = goal?.daily_target ?? 8000;
  const steps = health?.steps ?? 0;
  const pct = Math.min(100, Math.round((steps / target) * 100));
  const r = 60, c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;

  const [editGoal, setEditGoal] = useState(false);
  const [goalVal, setGoalVal] = useState(target);
  useEffect(() => setGoalVal(target), [target]);
  const [manual, setManual] = useState("");

  const saveGoal = useMutation({
    mutationFn: async (t: number) => {
      const user_id = await getUserId();
      const { error } = await supabase.from("step_goals").upsert({ user_id, daily_target: t, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["step_goal"] }); setEditGoal(false); toast.success("Goal updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const add = (n: number) => {
    patch.mutate({ steps: Math.max(0, steps + n) }, {
      onSuccess: () => {
        if (steps + n >= target && steps < target) toast.success("🎉 Daily step goal complete!");
      },
    });
  };
  const setExact = (n: number) => patch.mutate({ steps: Math.max(0, n) });

  const weekly7 = Array.from({ length: 7 }).map((_, i) => {
    const d = daysAgo(6 - i);
    return { day: d.slice(5), steps: weekly.find(x => x.log_date === d)?.steps ?? 0 };
  });

  return (
    <Card>
      <SectionTitle eyebrow="Movement">Steps</SectionTitle>
      <div className="flex items-center gap-5">
        <svg width="150" height="150" viewBox="0 0 150 150" className="-rotate-90 shrink-0">
          <circle cx="75" cy="75" r={r} className="stroke-muted" strokeWidth="12" fill="none" />
          <circle cx="75" cy="75" r={r} stroke="currentColor" className="text-accent transition-[stroke-dashoffset] duration-700 ease-out" strokeWidth="12" fill="none" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="font-display text-4xl font-semibold leading-none">{steps.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">of {target.toLocaleString()} · {pct}%</p>
          {editGoal ? (
            <div className="mt-2 flex items-center gap-2">
              <input type="number" value={goalVal} onChange={e => setGoalVal(+e.target.value)} className="w-24 rounded-lg bg-muted px-2 py-1 text-sm" />
              <button onClick={() => saveGoal.mutate(goalVal)} className="text-xs px-3 py-1 rounded-lg bg-foreground text-background tap-scale">Save</button>
              <button onClick={() => setEditGoal(false)} className="text-xs text-muted-foreground">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setEditGoal(true)} className="mt-2 text-xs text-muted-foreground hover:text-foreground">Edit target</button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {[500, 1000, 2000, 5000].map(n => (
          <button key={n} onClick={() => add(n)} className="rounded-xl bg-muted hover:bg-muted/70 px-2 py-2 text-xs font-medium tap-scale">+{n.toLocaleString()}</button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input type="number" value={manual} onChange={e => setManual(e.target.value)} placeholder="Set exact step count" className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm" />
        <button onClick={() => { if (manual) { setExact(+manual); setManual(""); } }} className="px-3 rounded-lg bg-foreground text-background text-sm tap-scale">Set</button>
        <button onClick={() => { if (confirm("Reset today's steps?")) setExact(0); }} className="px-3 rounded-lg bg-muted text-muted-foreground hover:text-foreground tap-scale" title="Reset"><RotateCcw className="size-4" /></button>
      </div>

      <div className="mt-4 h-20 -mx-2">
        <ResponsiveContainer>
          <BarChart data={weekly7}>
            <XAxis dataKey="day" hide />
            <YAxis hide />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
            <Bar dataKey="steps" fill="currentColor" className="fill-accent" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ---------- Water logger ---------- */

function WaterLogger() {
  const qc = useQueryClient();
  const date = today();
  const patch = useHealthPatch();

  const { data: health } = useQuery({
    queryKey: ["health", date],
    queryFn: async () => {
      const { data } = await supabase.from("health_logs").select("water_glasses").eq("log_date", date).maybeSingle();
      return data as { water_glasses: number } | null;
    },
  });
  const { data: weekly = [] } = useQuery({
    queryKey: ["water_week"],
    queryFn: async () => {
      const since = daysAgo(6);
      const { data } = await supabase.from("health_logs").select("log_date, water_glasses").gte("log_date", since).order("log_date");
      return (data ?? []) as { log_date: string; water_glasses: number }[];
    },
  });

  const glasses = health?.water_glasses ?? 0;
  const ml = glasses * 250;
  const goalMl = 2000;
  const pct = Math.min(100, (ml / goalMl) * 100);

  const addMl = (delta: number) => {
    const newGlasses = Math.max(0, Math.round((ml + delta) / 250));
    patch.mutate({ water_glasses: newGlasses }, {
      onSuccess: () => {
        if (ml < goalMl && newGlasses * 250 >= goalMl) toast.success("💧 Hydration goal complete!");
        qc.invalidateQueries({ queryKey: ["water_week"] });
      },
    });
  };

  const streak = useMemo(() => {
    const set = new Map(weekly.map(w => [w.log_date, w.water_glasses]));
    let s = 0;
    for (let i = 0; i < 7; i++) {
      const d = daysAgo(i);
      if ((set.get(d) ?? 0) * 250 >= goalMl) s++; else break;
    }
    return s;
  }, [weekly]);

  return (
    <Card>
      <SectionTitle eyebrow="Hydration">Water</SectionTitle>
      <div className="flex items-center gap-5">
        <div className="relative size-[150px] shrink-0 rounded-full border-2 border-border/60 overflow-hidden bg-muted/40">
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[color:oklch(0.7_0.14_220)] to-[color:oklch(0.85_0.1_220)] transition-[height] duration-700 ease-out" style={{ height: `${pct}%` }} />
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="font-display text-3xl font-semibold leading-none">{(ml / 1000).toFixed(2)}<span className="text-sm">L</span></p>
              <p className="text-[10px] text-muted-foreground mt-1">of 2L · {Math.round(pct)}%</p>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">🔥 {streak}-day hydration streak</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => addMl(250)} className="rounded-xl bg-muted hover:bg-muted/70 py-2 text-sm font-medium tap-scale">+250 ml</button>
            <button onClick={() => addMl(500)} className="rounded-xl bg-muted hover:bg-muted/70 py-2 text-sm font-medium tap-scale">+500 ml</button>
            <button onClick={() => addMl(1000)} className="rounded-xl bg-muted hover:bg-muted/70 py-2 text-sm font-medium tap-scale">+1 L</button>
            <button onClick={() => addMl(-250)} className="rounded-xl bg-muted hover:bg-muted/70 py-2 text-sm font-medium tap-scale">−250 ml</button>
          </div>
          <button onClick={() => { if (confirm("Reset today's water?")) patch.mutate({ water_glasses: 0 }); }} className="mt-2 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><RotateCcw className="size-3" /> Reset</button>
        </div>
      </div>
    </Card>
  );
}

/* ---------- Sleep ---------- */

function SleepLogger() {
  const date = today();
  const patch = useHealthPatch();
  const { data: health } = useQuery({
    queryKey: ["health", date],
    queryFn: async () => {
      const { data } = await supabase.from("health_logs").select("sleep_hours, bedtime, wake_time").eq("log_date", date).maybeSingle();
      return data as { sleep_hours: number; bedtime: string | null; wake_time: string | null } | null;
    },
  });
  const { data: weekly = [] } = useQuery({
    queryKey: ["sleep_week"],
    queryFn: async () => {
      const since = daysAgo(6);
      const { data } = await supabase.from("health_logs").select("log_date, sleep_hours").gte("log_date", since).order("log_date");
      return (data ?? []) as { log_date: string; sleep_hours: number }[];
    },
  });

  const [hours, setHours] = useState<string>("");
  const [bedtime, setBedtime] = useState("");
  const [wake, setWake] = useState("");
  useEffect(() => {
    setHours(health?.sleep_hours ? String(health.sleep_hours) : "");
    setBedtime(health?.bedtime?.slice(0, 5) ?? "");
    setWake(health?.wake_time?.slice(0, 5) ?? "");
  }, [health?.sleep_hours, health?.bedtime, health?.wake_time]);

  function computeFromTimes(bed: string, w: string) {
    if (!bed || !w) return null;
    const [bh, bm] = bed.split(":").map(Number);
    const [wh, wm] = w.split(":").map(Number);
    let mins = (wh * 60 + wm) - (bh * 60 + bm);
    if (mins <= 0) mins += 24 * 60;
    return +(mins / 60).toFixed(1);
  }

  const save = () => {
    let h = parseFloat(hours);
    const fromTimes = computeFromTimes(bedtime, wake);
    if (!isNaN(fromTimes ?? NaN) && (!hours || fromTimes !== null)) h = fromTimes!;
    if (isNaN(h) || h < 0 || h > 24) return toast.error("Enter valid sleep hours");
    patch.mutate({ sleep_hours: h, bedtime: bedtime || null, wake_time: wake || null }, {
      onSuccess: () => toast.success("Sleep saved"),
    });
  };

  const avg = weekly.length ? (weekly.reduce((s, w) => s + Number(w.sleep_hours ?? 0), 0) / weekly.length).toFixed(1) : "0.0";
  const cur = Number(health?.sleep_hours ?? 0);
  const quality = cur === 0 ? "—" : cur >= 7 && cur <= 9 ? "Optimal" : cur >= 6 ? "Fair" : cur > 0 ? "Low" : "—";

  return (
    <Card>
      <SectionTitle eyebrow="Recovery">Sleep</SectionTitle>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-display text-5xl font-semibold leading-none">{cur.toFixed(1)}<span className="text-base text-muted-foreground ml-1">h</span></span>
        <span className="text-xs text-muted-foreground">{quality} · 7d avg {avg}h</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Bedtime"><input type="time" value={bedtime} onChange={e => setBedtime(e.target.value)} className="w-full rounded-lg bg-muted px-2 py-2 text-sm" /></Field>
        <Field label="Wake"><input type="time" value={wake} onChange={e => setWake(e.target.value)} className="w-full rounded-lg bg-muted px-2 py-2 text-sm" /></Field>
        <Field label="Hours"><input type="number" step="0.1" value={hours} onChange={e => setHours(e.target.value)} placeholder="auto" className="w-full rounded-lg bg-muted px-2 py-2 text-sm" /></Field>
      </div>
      <button onClick={save} className="mt-3 w-full rounded-lg bg-foreground text-background py-2 text-sm tap-scale">Save sleep</button>
      <div className="mt-4 h-20 -mx-2">
        <ResponsiveContainer>
          <BarChart data={weekly.map(w => ({ d: w.log_date.slice(5), h: Number(w.sleep_hours ?? 0) }))}>
            <XAxis dataKey="d" hide /><YAxis hide />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
            <Bar dataKey="h" fill="currentColor" className="fill-[color:oklch(0.7_0.12_280)]" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ---------- Weight (with history + delete) ---------- */

function WeightTracker() {
  const qc = useQueryClient();
  const since = daysAgo(29);
  const { data: logs = [] } = useQuery({
    queryKey: ["weight_logs"],
    queryFn: async () => {
      const { data } = await supabase.from("weight_logs").select("*").gte("log_date", since).order("log_date");
      return (data ?? []) as { id: string; log_date: string; weight_kg: number }[];
    },
  });
  const [w, setW] = useState("");

  const add = useMutation({
    mutationFn: async (kg: number) => {
      const user_id = await getUserId();
      const { error } = await supabase.from("weight_logs").upsert({ user_id, log_date: today(), weight_kg: kg }, { onConflict: "user_id,log_date" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["weight_logs"] }); setW(""); toast.success("Weight logged"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("weight_logs").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["weight_logs"] }); toast.success("Removed"); },
  });
  const edit = useMutation({
    mutationFn: async ({ id, kg }: { id: string; kg: number }) => {
      const { error } = await supabase.from("weight_logs").update({ weight_kg: kg }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weight_logs"] }),
  });

  const latest = logs[logs.length - 1]?.weight_kg;
  const first = logs[0]?.weight_kg;
  const delta = latest && first ? (latest - first).toFixed(1) : "0.0";

  return (
    <Card>
      <SectionTitle eyebrow="Body">Weight</SectionTitle>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-display text-5xl font-semibold leading-none">{latest ?? "—"}<span className="text-base text-muted-foreground ml-1">kg</span></span>
        {latest && <span className={`text-xs ${+delta > 0 ? "text-destructive" : "text-accent"}`}>{+delta > 0 ? "+" : ""}{delta} kg / 30d</span>}
      </div>
      <div className="h-28 -mx-2">
        <ResponsiveContainer>
          <LineChart data={logs}>
            <XAxis dataKey="log_date" hide />
            <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
            <Line type="monotone" dataKey="weight_kg" stroke="currentColor" className="text-accent" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex gap-2">
        <input value={w} onChange={e => setW(e.target.value)} placeholder="Today's weight (kg)" type="number" step="0.1" className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm" />
        <button onClick={() => w && add.mutate(parseFloat(w))} className="px-4 rounded-lg bg-foreground text-background text-sm tap-scale">Log</button>
      </div>
      {logs.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">History ({logs.length})</summary>
          <ul className="mt-2 divide-y divide-border/60 max-h-40 overflow-auto">
            {[...logs].reverse().map(l => (
              <li key={l.id} className="py-1.5 flex items-center justify-between text-sm">
                <span>{l.log_date}</span>
                <span className="flex items-center gap-2">
                  <span>{l.weight_kg} kg</span>
                  <button onClick={() => { const n = prompt("Weight (kg)", String(l.weight_kg)); if (n) edit.mutate({ id: l.id, kg: parseFloat(n) }); }} className="text-muted-foreground hover:text-foreground"><Pencil className="size-3.5" /></button>
                  <button onClick={() => { if (confirm("Delete entry?")) del.mutate(l.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

/* ---------- Workouts (new) ---------- */

const WORKOUT_TYPES = ["walking", "running", "gym", "cycling", "yoga", "swimming", "custom"] as const;

function WorkoutTracker() {
  const qc = useQueryClient();
  const { data: workouts = [] } = useQuery({
    queryKey: ["workouts_all"],
    queryFn: async () => {
      const since = daysAgo(29);
      const { data } = await supabase.from("workouts").select("*").gte("log_date", since).order("log_date", { ascending: false }).order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const [form, setForm] = useState({ workout_type: "walking", duration_min: "", calories_burned: "", notes: "", log_date: today() });

  const add = useMutation({
    mutationFn: async () => {
      const user_id = await getUserId();
      const { error } = await supabase.from("workouts").insert({
        user_id,
        workout_type: form.workout_type,
        duration_min: +form.duration_min || 0,
        calories_burned: +form.calories_burned || 0,
        notes: form.notes || null,
        log_date: form.log_date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workouts_all"] });
      qc.invalidateQueries({ queryKey: ["workouts"] });
      setForm({ ...form, duration_min: "", calories_burned: "", notes: "" });
      toast.success("Workout logged 💪");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("workouts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workouts_all"] }); qc.invalidateQueries({ queryKey: ["workouts"] }); toast.success("Removed"); },
  });
  const edit = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => { const { error } = await supabase.from("workouts").update(patch).eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workouts_all"] }); qc.invalidateQueries({ queryKey: ["workouts"] }); },
  });

  const totalsThisWeek = useMemo(() => {
    const since = daysAgo(6);
    const recent = workouts.filter(w => w.log_date >= since);
    return {
      sessions: recent.length,
      minutes: recent.reduce((s, w) => s + (w.duration_min ?? 0), 0),
      calories: recent.reduce((s, w) => s + (w.calories_burned ?? 0), 0),
    };
  }, [workouts]);

  return (
    <section>
      <SectionTitle eyebrow="Training">Workouts</SectionTitle>
      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <Metric icon={<Dumbbell className="size-4" />} label="Sessions / 7d" value={totalsThisWeek.sessions} suffix="" />
        <Metric icon={<Activity className="size-4" />} label="Minutes / 7d" value={totalsThisWeek.minutes} suffix="" />
        <Metric icon={<Flame className="size-4" />} label="Calories / 7d" value={totalsThisWeek.calories} suffix=" kcal" />
      </div>

      <Card className="mb-4">
        <div className="grid gap-2 md:grid-cols-6">
          <select value={form.workout_type} onChange={e => setForm({ ...form, workout_type: e.target.value })} className="rounded-lg bg-muted px-3 py-2 text-sm capitalize">
            {WORKOUT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="number" placeholder="Duration (min)" value={form.duration_min} onChange={e => setForm({ ...form, duration_min: e.target.value })} className="rounded-lg bg-muted px-3 py-2 text-sm" />
          <input type="number" placeholder="Calories burned" value={form.calories_burned} onChange={e => setForm({ ...form, calories_burned: e.target.value })} className="rounded-lg bg-muted px-3 py-2 text-sm" />
          <input type="date" value={form.log_date} onChange={e => setForm({ ...form, log_date: e.target.value })} className="rounded-lg bg-muted px-3 py-2 text-sm" />
          <input placeholder="Notes (optional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="md:col-span-2 rounded-lg bg-muted px-3 py-2 text-sm" />
        </div>
        <button onClick={() => { if (!form.duration_min) return toast.error("Enter duration"); add.mutate(); }} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-4 py-2 text-sm tap-scale">
          <Plus className="size-4" /> Log workout
        </button>
      </Card>

      <Card className="!p-4">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">History (last 30 days)</h3>
        {workouts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">No workouts logged yet. Add your first one above 💪</p>
        ) : (
          <ul className="divide-y divide-border/60 max-h-80 overflow-auto">
            {workouts.map(w => (
              <li key={w.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium capitalize">{w.workout_type}</p>
                  <p className="text-xs text-muted-foreground">{w.log_date} · {w.duration_min}m · {w.calories_burned} kcal{w.notes ? ` · ${w.notes}` : ""}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => {
                    const dur = prompt("Duration (min)", String(w.duration_min)); if (dur === null) return;
                    const cal = prompt("Calories burned", String(w.calories_burned)); if (cal === null) return;
                    const notes = prompt("Notes", w.notes ?? "") ?? w.notes;
                    edit.mutate({ id: w.id, patch: { duration_min: +dur || 0, calories_burned: +cal || 0, notes: notes || null } });
                  }} className="text-muted-foreground hover:text-foreground"><Pencil className="size-4" /></button>
                  <button onClick={() => { if (confirm("Delete workout?")) del.mutate(w.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

/* ---------- Nutrition ---------- */

const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;

function Nutrition() {
  const qc = useQueryClient();
  const date = today();
  const { data: logs = [] } = useQuery({
    queryKey: ["nutrition", date],
    queryFn: async () => {
      const { data } = await supabase.from("nutrition_logs").select("*").eq("log_date", date).order("created_at");
      return (data ?? []) as any[];
    },
  });

  const totals = logs.reduce((a, l) => ({
    calories: a.calories + (l.calories ?? 0),
    protein: a.protein + Number(l.protein_g ?? 0),
    carbs: a.carbs + Number(l.carbs_g ?? 0),
    fat: a.fat + Number(l.fat_g ?? 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const calGoal = 2200;

  const [form, setForm] = useState({ meal_type: "breakfast", name: "", calories: "", protein_g: "", carbs_g: "", fat_g: "" });
  const add = useMutation({
    mutationFn: async () => {
      const user_id = await getUserId();
      const { error } = await supabase.from("nutrition_logs").insert({
        user_id, log_date: date,
        meal_type: form.meal_type, name: form.name,
        calories: +form.calories || 0, protein_g: +form.protein_g || 0,
        carbs_g: +form.carbs_g || 0, fat_g: +form.fat_g || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["nutrition"] }); setForm({ ...form, name: "", calories: "", protein_g: "", carbs_g: "", fat_g: "" }); toast.success("Meal added"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("nutrition_logs").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["nutrition"] }); toast.success("Removed"); },
  });
  const edit = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => { await supabase.from("nutrition_logs").update(patch).eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nutrition"] }),
  });

  return (
    <section>
      <SectionTitle eyebrow="Fuel">Nutrition</SectionTitle>
      <Card className="mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="font-display text-3xl font-semibold">{totals.calories} <span className="text-sm text-muted-foreground">/ {calGoal} kcal</span></span>
          <span className="text-xs text-muted-foreground">{Math.max(0, calGoal - totals.calories)} remaining</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${Math.min(100, (totals.calories / calGoal) * 100)}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 text-center">
          <Macro label="Protein" value={totals.protein} color="bg-[color:oklch(0.72_0.15_25)]" />
          <Macro label="Carbs" value={totals.carbs} color="bg-[color:oklch(0.78_0.13_85)]" />
          <Macro label="Fat" value={totals.fat} color="bg-[color:oklch(0.7_0.12_280)]" />
        </div>
      </Card>

      <Card className="mb-4">
        <div className="grid gap-2 md:grid-cols-6">
          <select value={form.meal_type} onChange={e => setForm({ ...form, meal_type: e.target.value })} className="rounded-lg bg-muted px-3 py-2 text-sm capitalize">
            {MEALS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input className="md:col-span-2 rounded-lg bg-muted px-3 py-2 text-sm" placeholder="Food name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="rounded-lg bg-muted px-3 py-2 text-sm" placeholder="kcal" type="number" value={form.calories} onChange={e => setForm({ ...form, calories: e.target.value })} />
          <div className="grid grid-cols-3 gap-1 md:col-span-2">
            <input className="rounded-lg bg-muted px-2 py-2 text-sm" placeholder="P" type="number" value={form.protein_g} onChange={e => setForm({ ...form, protein_g: e.target.value })} />
            <input className="rounded-lg bg-muted px-2 py-2 text-sm" placeholder="C" type="number" value={form.carbs_g} onChange={e => setForm({ ...form, carbs_g: e.target.value })} />
            <input className="rounded-lg bg-muted px-2 py-2 text-sm" placeholder="F" type="number" value={form.fat_g} onChange={e => setForm({ ...form, fat_g: e.target.value })} />
          </div>
        </div>
        <button onClick={() => form.name ? add.mutate() : toast.error("Enter a food name")} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-4 py-2 text-sm tap-scale"><Plus className="size-4" /> Log meal</button>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {MEALS.map(m => {
          const items = logs.filter(l => l.meal_type === m);
          return (
            <Card key={m} className="!p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium capitalize flex items-center gap-2"><Apple className="size-4 text-muted-foreground" />{m}</h3>
                <span className="text-xs text-muted-foreground">{items.reduce((s, i) => s + i.calories, 0)} kcal</span>
              </div>
              {items.length === 0 ? <p className="text-xs text-muted-foreground py-2">Nothing logged</p> : (
                <ul className="divide-y divide-border/60">
                  {items.map(i => (
                    <li key={i.id} className="py-2 flex items-center justify-between text-sm">
                      <span className="truncate">{i.name}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">{i.calories} kcal</span>
                        <button onClick={() => {
                          const n = prompt("Name", i.name); if (!n) return;
                          const c = prompt("Calories", String(i.calories)); if (c === null) return;
                          edit.mutate({ id: i.id, patch: { name: n, calories: +c || 0 } });
                        }} className="text-muted-foreground hover:text-foreground"><Pencil className="size-3.5" /></button>
                        <button onClick={() => { if (confirm("Delete meal?")) del.mutate(i.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function Macro({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className={`mx-auto size-2 rounded-full ${color}`} />
      <div className="font-display text-xl mt-1.5">{value.toFixed(0)}g</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

/* ---------- BMI ---------- */

function BMICalculator() {
  const [height, setHeight] = useState(170);
  const [weight, setWeight] = useState(70);
  const [age, setAge] = useState(25);
  const [gender, setGender] = useState<"male" | "female" | "other">("male");

  const bmi = useMemo(() => weight / Math.pow(height / 100, 2), [height, weight]);
  const cat = bmi < 18.5 ? { label: "Underweight", color: "text-[color:oklch(0.7_0.12_240)]", tip: "Add nutrient-dense calories and strength training." }
    : bmi < 25 ? { label: "Healthy", color: "text-accent", tip: "Maintain with balanced meals and consistent movement." }
    : bmi < 30 ? { label: "Overweight", color: "text-[color:oklch(0.75_0.15_55)]", tip: "Modest calorie deficit + 150+ min/wk of activity." }
    : { label: "Obese", color: "text-destructive", tip: "Consider a sustainable plan with professional guidance." };
  const pct = Math.min(100, Math.max(0, ((bmi - 15) / 25) * 100));
  void age; void gender;

  return (
    <Card>
      <SectionTitle eyebrow="Index">BMI Calculator</SectionTitle>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="Height (cm)"><input type="number" value={height} onChange={e => setHeight(+e.target.value)} className="w-full rounded-lg bg-muted px-3 py-2 text-sm" /></Field>
        <Field label="Weight (kg)"><input type="number" value={weight} onChange={e => setWeight(+e.target.value)} className="w-full rounded-lg bg-muted px-3 py-2 text-sm" /></Field>
        <Field label="Age"><input type="number" value={age} onChange={e => setAge(+e.target.value)} className="w-full rounded-lg bg-muted px-3 py-2 text-sm" /></Field>
        <Field label="Gender">
          <select value={gender} onChange={e => setGender(e.target.value as any)} className="w-full rounded-lg bg-muted px-3 py-2 text-sm">
            <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
          </select>
        </Field>
      </div>
      <div className="text-center py-2">
        <p className="font-display text-6xl font-semibold leading-none">{bmi.toFixed(1)}</p>
        <p className={`mt-2 text-sm font-medium ${cat.color}`}>{cat.label}</p>
        <p className="text-xs text-muted-foreground mt-1">Healthy range 18.5–24.9 · {cat.tip}</p>
      </div>
      <div className="relative mt-4 h-2 rounded-full bg-gradient-to-r from-[color:oklch(0.7_0.12_240)] via-accent via-[color:oklch(0.75_0.15_55)] to-destructive">
        <div className="absolute top-1/2 -translate-y-1/2 size-4 rounded-full bg-foreground border-2 border-background transition-all duration-500" style={{ left: `calc(${pct}% - 8px)` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
        <span>15</span><span>18.5</span><span>25</span><span>30</span><span>40</span>
      </div>
    </Card>
  );
}

/* ---------- Calorie planner ---------- */

const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 } as const;

function CalorieCalculator() {
  const [height, setHeight] = useState(170);
  const [weight, setWeight] = useState(70);
  const [age, setAge] = useState(25);
  const [gender, setGender] = useState<"male" | "female">("male");
  const [act, setAct] = useState<keyof typeof ACTIVITY>("moderate");
  const [goal, setGoal] = useState<"loss" | "maintain" | "gain">("maintain");

  const bmr = gender === "male" ? 10 * weight + 6.25 * height - 5 * age + 5 : 10 * weight + 6.25 * height - 5 * age - 161;
  const tdee = Math.round(bmr * ACTIVITY[act]);
  const target = goal === "loss" ? tdee - 500 : goal === "gain" ? tdee + 300 : tdee;
  const weeklyKg = goal === "loss" ? 0.45 : goal === "gain" ? -0.27 : 0;

  const protein = Math.round((target * (goal === "gain" ? 0.3 : 0.35)) / 4);
  const fat = Math.round((target * 0.25) / 9);
  const carbs = Math.round((target - protein * 4 - fat * 9) / 4);

  return (
    <Card>
      <SectionTitle eyebrow="Targets">Calorie planner</SectionTitle>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Height (cm)"><input type="number" value={height} onChange={e => setHeight(+e.target.value)} className="w-full rounded-lg bg-muted px-3 py-2 text-sm" /></Field>
        <Field label="Weight (kg)"><input type="number" value={weight} onChange={e => setWeight(+e.target.value)} className="w-full rounded-lg bg-muted px-3 py-2 text-sm" /></Field>
        <Field label="Age"><input type="number" value={age} onChange={e => setAge(+e.target.value)} className="w-full rounded-lg bg-muted px-3 py-2 text-sm" /></Field>
        <Field label="Gender">
          <select value={gender} onChange={e => setGender(e.target.value as any)} className="w-full rounded-lg bg-muted px-3 py-2 text-sm">
            <option value="male">Male</option><option value="female">Female</option>
          </select>
        </Field>
        <Field label="Activity">
          <select value={act} onChange={e => setAct(e.target.value as any)} className="w-full rounded-lg bg-muted px-3 py-2 text-sm">
            <option value="sedentary">Sedentary</option><option value="light">Light</option><option value="moderate">Moderate</option><option value="active">Active</option><option value="very_active">Very active</option>
          </select>
        </Field>
        <Field label="Goal">
          <select value={goal} onChange={e => setGoal(e.target.value as any)} className="w-full rounded-lg bg-muted px-3 py-2 text-sm">
            <option value="loss">Fat loss</option><option value="maintain">Maintenance</option><option value="gain">Muscle gain</option>
          </select>
        </Field>
      </div>
      <div className="rounded-2xl bg-muted/50 p-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Maintenance</p>
          <p className="font-display text-3xl">{tdee}<span className="text-xs text-muted-foreground"> kcal</span></p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Target</p>
          <p className="font-display text-3xl text-accent">{target}<span className="text-xs text-muted-foreground"> kcal</span></p>
        </div>
        {weeklyKg !== 0 && (
          <div className="col-span-2 text-xs text-muted-foreground">
            Estimated {goal === "loss" ? "loss" : "gain"}: <span className="text-foreground font-medium">{Math.abs(weeklyKg).toFixed(2)} kg / week</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <MacroPill label="Protein" g={protein} color="bg-[color:oklch(0.72_0.15_25)]" />
        <MacroPill label="Carbs" g={carbs} color="bg-[color:oklch(0.78_0.13_85)]" />
        <MacroPill label="Fat" g={fat} color="bg-[color:oklch(0.7_0.12_280)]" />
      </div>
    </Card>
  );
}

function MacroPill({ label, g, color }: { label: string; g: number; color: string }) {
  return (
    <div className="rounded-xl bg-card border border-border/60 p-3 text-center">
      <span className={`inline-block size-2 rounded-full ${color}`} />
      <p className="font-display text-xl mt-1">{g}g</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

/* ---------- Weekly summary ---------- */

function WeeklySummary() {
  const since = daysAgo(6);
  const { data: logs = [] } = useQuery({
    queryKey: ["health_week"],
    queryFn: async () => {
      const { data } = await supabase.from("health_logs").select("*").gte("log_date", since).order("log_date");
      return (data ?? []) as any[];
    },
  });
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = daysAgo(6 - i);
    const l = logs.find(x => x.log_date === d);
    return { day: d.slice(5), steps: l?.steps ?? 0, sleep: Number(l?.sleep_hours ?? 0), workout: l?.workout_min ?? 0 };
  });

  return (
    <section>
      <SectionTitle eyebrow="Trends">Weekly summary</SectionTitle>
      <Card>
        <div className="h-48 -mx-2">
          <ResponsiveContainer>
            <LineChart data={days}>
              <XAxis dataKey="day" stroke="oklch(from var(--muted-foreground) l c h / 0.6)" fontSize={10} />
              <YAxis stroke="oklch(from var(--muted-foreground) l c h / 0.6)" fontSize={10} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              <Line type="monotone" dataKey="steps" stroke="currentColor" className="text-accent" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="workout" stroke="currentColor" className="text-foreground/50" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground mt-2">
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" /> Steps</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-foreground/50" /> Workout min</span>
        </div>
      </Card>
    </section>
  );
}
