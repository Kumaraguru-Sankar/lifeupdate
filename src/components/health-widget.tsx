import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Moon, Droplet, Dumbbell } from "lucide-react";

type Log = { steps: number; sleep_hours: number; water_glasses: number; workout_min: number };

const today = () => new Date().toISOString().slice(0, 10);

export function HealthWidget() {
  const qc = useQueryClient();
  const date = today();

  const { data } = useQuery({
    queryKey: ["health", date],
    queryFn: async () => {
      const { data } = await supabase.from("health_logs").select("*").eq("log_date", date).maybeSingle();
      return data as (Log & { id: string }) | null;
    },
  });

  const [form, setForm] = useState<Log>({ steps: 0, sleep_hours: 0, water_glasses: 0, workout_min: 0 });

  useEffect(() => {
    if (data) setForm({ steps: data.steps ?? 0, sleep_hours: Number(data.sleep_hours) ?? 0, water_glasses: data.water_glasses ?? 0, workout_min: data.workout_min ?? 0 });
  }, [data?.id]);

  const save = useMutation({
    mutationFn: async (patch: Partial<Log>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const next = { ...form, ...patch };
      setForm(next);
      const { error } = await supabase.from("health_logs").upsert({ user_id: user.id, log_date: date, ...next }, { onConflict: "user_id,log_date" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["health"] }),
  });

  return (
    <section className="mb-8">
      <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Body</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile icon={<Activity className="size-4" />} label="Steps" value={form.steps} suffix="" step={500} onChange={v => save.mutate({ steps: v })} />
        <Tile icon={<Moon className="size-4" />} label="Sleep" value={form.sleep_hours} suffix="h" step={0.5} decimal onChange={v => save.mutate({ sleep_hours: v })} />
        <Tile icon={<Droplet className="size-4" />} label="Water" value={form.water_glasses} suffix=" gl" step={1} onChange={v => save.mutate({ water_glasses: v })} />
        <Tile icon={<Dumbbell className="size-4" />} label="Workout" value={form.workout_min} suffix="m" step={5} onChange={v => save.mutate({ workout_min: v })} />
      </div>
    </section>
  );
}

function Tile({ icon, label, value, suffix, step, decimal, onChange }: {
  icon: React.ReactNode; label: string; value: number; suffix: string; step: number; decimal?: boolean;
  onChange: (v: number) => void;
}) {
  const display = decimal ? value.toFixed(1) : value;
  return (
    <div className="rounded-2xl bg-card border border-border/60 p-3 shadow-soft">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 font-display text-2xl leading-none">{display}<span className="text-xs text-muted-foreground">{suffix}</span></div>
      <div className="mt-2 flex items-center gap-1.5">
        <button onClick={() => onChange(Math.max(0, +(value - step).toFixed(1)))} className="size-7 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 tap-scale text-sm">−</button>
        <button onClick={() => onChange(+(value + step).toFixed(1))} className="flex-1 h-7 rounded-lg bg-foreground text-background text-xs tap-scale">+{step}</button>
      </div>
    </div>
  );
}
