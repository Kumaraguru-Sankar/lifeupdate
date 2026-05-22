import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Moon, Droplet, Dumbbell, Flame, Scale, Apple, Plus, Trash2 } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

export const Route = createFileRoute("/_authenticated/health")({ component: HealthPage });

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

function HealthPage() {
  return (
    <AppShell title="Health" subtitle="Wellness Operating System">
      <div className="space-y-8">
        <Overview />
        <div className="grid gap-5 lg:grid-cols-2">
          <StepRing />
          <WeightTracker />
        </div>
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

/* ---------- Section helpers ---------- */

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
  const consumed = nutrition.reduce((s, n) => s + (n.calories ?? 0), 0);
  const burned = health?.calories_burned ?? 0;
  const score = Math.min(100, Math.round(
    ((health?.steps ?? 0) / 10000) * 25 +
    Math.min(1, (health?.water_glasses ?? 0) / 8) * 25 +
    Math.min(1, (health?.sleep_hours ?? 0) / 8) * 25 +
    Math.min(1, (health?.workout_min ?? 0) / 30) * 25
  ));

  return (
    <section>
      <SectionTitle eyebrow="Today">Health overview</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ScoreCard score={score} />
        <Metric icon={<Flame className="size-4" />} label="Consumed" value={consumed} suffix=" kcal" />
        <Metric icon={<Activity className="size-4" />} label="Burned" value={burned} suffix=" kcal" />
        <Metric icon={<Flame className="size-4" />} label="Net" value={consumed - burned} suffix=" kcal" tone={consumed - burned > 2500 ? "warn" : "ok"} />
        <Metric icon={<Activity className="size-4" />} label="Steps" value={health?.steps ?? 0} suffix="" />
        <Metric icon={<Droplet className="size-4" />} label="Water" value={health?.water_glasses ?? 0} suffix=" gl" />
        <Metric icon={<Moon className="size-4" />} label="Sleep" value={Number(health?.sleep_hours ?? 0).toFixed(1)} suffix="h" />
        <Metric icon={<Dumbbell className="size-4" />} label="Workout" value={health?.workout_min ?? 0} suffix="m" />
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

/* ---------- Step ring ---------- */

function StepRing() {
  const qc = useQueryClient();
  const date = today();
  const { data: goal } = useQuery({
    queryKey: ["step_goal"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("step_goals").select("*").eq("user_id", user.id).maybeSingle();
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

  const target = goal?.daily_target ?? 8000;
  const steps = health?.steps ?? 0;
  const pct = Math.min(100, Math.round((steps / target) * 100));
  const r = 70, c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;

  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(target);
  useEffect(() => setVal(target), [target]);

  const saveGoal = useMutation({
    mutationFn: async (t: number) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("");
      await supabase.from("step_goals").upsert({ user_id: user.id, daily_target: t, updated_at: new Date().toISOString() });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["step_goal"] }); setEditing(false); },
  });

  return (
    <Card>
      <SectionTitle eyebrow="Movement">Step goal</SectionTitle>
      <div className="flex items-center gap-6">
        <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90 shrink-0">
          <circle cx="90" cy="90" r={r} className="stroke-muted" strokeWidth="14" fill="none" />
          <circle cx="90" cy="90" r={r} stroke="currentColor" className="text-accent transition-[stroke-dashoffset] duration-700 ease-out" strokeWidth="14" fill="none" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
        </svg>
        <div className="min-w-0">
          <p className="font-display text-5xl font-semibold leading-none">{steps.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground mt-2">of {target.toLocaleString()} steps</p>
          <p className="text-xs text-accent mt-1">{pct}% complete</p>
          {editing ? (
            <div className="mt-3 flex items-center gap-2">
              <input type="number" value={val} onChange={e => setVal(+e.target.value)} className="w-24 rounded-lg bg-muted px-2 py-1 text-sm" />
              <button onClick={() => saveGoal.mutate(val)} className="text-xs px-3 py-1 rounded-lg bg-foreground text-background tap-scale">Save</button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="mt-3 text-xs text-muted-foreground hover:text-foreground">Edit target</button>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ---------- Weight ---------- */

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("");
      await supabase.from("weight_logs").upsert({ user_id: user.id, log_date: today(), weight_kg: kg }, { onConflict: "user_id,log_date" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["weight_logs"] }); setW(""); },
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
      <div className="h-32 -mx-2">
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
    </Card>
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("");
      await supabase.from("nutrition_logs").insert({
        user_id: user.id, log_date: date,
        meal_type: form.meal_type, name: form.name,
        calories: +form.calories || 0, protein_g: +form.protein_g || 0,
        carbs_g: +form.carbs_g || 0, fat_g: +form.fat_g || 0,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["nutrition"] }); setForm({ ...form, name: "", calories: "", protein_g: "", carbs_g: "", fat_g: "" }); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("nutrition_logs").delete().eq("id", id); },
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
          <select value={form.meal_type} onChange={e => setForm({ ...form, meal_type: e.target.value })} className="rounded-lg bg-muted px-3 py-2 text-sm">
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
        <button onClick={() => form.name && add.mutate()} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-4 py-2 text-sm tap-scale"><Plus className="size-4" /> Log meal</button>
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
                      <span className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-muted-foreground">{i.calories} kcal</span>
                        <button onClick={() => del.mutate(i.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
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
  const cat = bmi < 18.5 ? { label: "Underweight", color: "text-[color:oklch(0.7_0.12_240)]" }
    : bmi < 25 ? { label: "Healthy", color: "text-accent" }
    : bmi < 30 ? { label: "Overweight", color: "text-[color:oklch(0.75_0.15_55)]" }
    : { label: "Obese", color: "text-destructive" };
  const pct = Math.min(100, Math.max(0, ((bmi - 15) / 25) * 100));

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

/* ---------- Calorie calc ---------- */

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
