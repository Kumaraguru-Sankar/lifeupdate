import { safeErrorMessage } from "@/lib/safe-error";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({ component: Onboarding });

const ARCHETYPES = [
  { id: "builder", label: "The Builder", desc: "Ships things. Deep focus over chaos." },
  { id: "explorer", label: "The Explorer", desc: "Curious mind. Loves to learn widely." },
  { id: "operator", label: "The Operator", desc: "Systems and consistency. Calm execution." },
  { id: "creator", label: "The Creator", desc: "Makes art, content, ideas. Lives in flow." },
];

const STARTER_HABITS = ["Read 20 min", "Walk 30 min", "Deep work 90 min", "Sleep before 11", "Meditate 10 min", "Drink 2L water"];

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [vision, setVision] = useState("");
  const [archetype, setArchetype] = useState<string | null>(null);
  const [goal, setGoal] = useState("");
  const [habits, setHabits] = useState<string[]>([]);

  const toggleHabit = (h: string) => setHabits(prev => prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h]);

  const finish = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      await supabase.from("profiles").update({ onboarding_completed: true, archetype, vision }).eq("id", user.id);
      let goalId: string | null = null;
      if (goal.trim() || habits.length) {
        const { data: g, error } = await supabase.from("goals")
          .insert({ user_id: user.id, title: goal.trim() || "Build better habits" }).select("id").single();
        if (error) throw error;
        goalId = g.id;
      }
      if (habits.length) {
        const { error } = await supabase.from("habits").insert(habits.map((name, i) => ({ user_id: user.id, name, goal_id: goalId, sort_order: i })));
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("Welcome to LifeUpdate"); navigate({ to: "/" }); },
    onError: (e: Error) => toast.error(safeErrorMessage(e)),
  });

  const steps = [
    { title: "Welcome", body: (
      <div className="text-center">
        <div className="size-16 rounded-2xl bg-foreground text-background grid place-items-center mx-auto font-display text-3xl shadow-lift">L</div>
        <h1 className="font-display text-5xl mt-6 leading-none">LifeUpdate</h1>
        <p className="text-muted-foreground mt-3 leading-relaxed max-w-sm mx-auto">A calm command center for your tasks, habits, and ambitions. Let's set you up in under a minute.</p>
      </div>
    )},
    { title: "Your vision", body: (
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">In one sentence…</p>
        <h2 className="font-display text-3xl mb-5 leading-tight">What's the life you're building?</h2>
        <textarea value={vision} onChange={e => setVision(e.target.value)} rows={4} placeholder="I want to build a thoughtful product, stay healthy, and create with the people I love."
          className="w-full rounded-2xl bg-card border border-border/60 p-4 outline-none text-[15px] leading-relaxed placeholder:text-muted-foreground focus:border-accent/60 transition-colors" />
      </div>
    )},
    { title: "Archetype", body: (
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">Which fits best today?</p>
        <h2 className="font-display text-3xl mb-5 leading-tight">Your productivity archetype</h2>
        <div className="grid gap-2">
          {ARCHETYPES.map(a => (
            <button key={a.id} onClick={() => setArchetype(a.id)} className={cn("text-left p-4 rounded-2xl border transition-all tap-scale", archetype === a.id ? "bg-foreground text-background border-foreground shadow-lift" : "bg-card border-border/60 hover:border-border")}>
              <div className="font-display text-xl">{a.label}</div>
              <div className={cn("text-xs mt-1", archetype === a.id ? "text-background/70" : "text-muted-foreground")}>{a.desc}</div>
            </button>
          ))}
        </div>
      </div>
    )},
    { title: "Goal", body: (
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">Optional</p>
        <h2 className="font-display text-3xl mb-5 leading-tight">One goal to start.</h2>
        <input value={goal} onChange={e => setGoal(e.target.value)} placeholder="e.g. Launch my side project by August"
          className="w-full h-12 rounded-2xl bg-card border border-border/60 px-4 outline-none text-[15px] placeholder:text-muted-foreground focus:border-accent/60 transition-colors" />
      </div>
    )},
    { title: "Habits", body: (
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">Pick 1–3</p>
        <h2 className="font-display text-3xl mb-5 leading-tight">Small daily habits.</h2>
        <div className="flex flex-wrap gap-2">
          {STARTER_HABITS.map(h => (
            <button key={h} onClick={() => toggleHabit(h)} className={cn("px-4 py-2 rounded-full text-sm border transition-all tap-scale", habits.includes(h) ? "bg-foreground text-background border-foreground" : "bg-card border-border/60 text-muted-foreground hover:text-foreground")}>{h}</button>
          ))}
        </div>
      </div>
    )},
  ];

  const last = step === steps.length - 1;
  const canNext = step === 0 || (step === 1 ? vision.trim().length > 0 : step === 2 ? !!archetype : true);

  return (
    <div className="min-h-dvh bg-background text-foreground grid place-items-center px-5">
      <div className="w-full max-w-md fade-in-up">
        <div className="flex items-center gap-1.5 justify-center mb-10">
          {steps.map((_, i) => (
            <span key={i} className={cn("h-1 rounded-full transition-all duration-500", i <= step ? "w-8 bg-foreground" : "w-4 bg-muted")} />
          ))}
        </div>
        <div className="min-h-[260px]">{steps[step].body}</div>

        <div className="mt-10 flex items-center justify-between gap-3">
          <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} className="text-sm text-muted-foreground disabled:opacity-30">Back</button>
          {last ? (
            <button onClick={() => finish.mutate()} disabled={finish.isPending} className="rounded-full bg-foreground text-background px-6 h-11 inline-flex items-center gap-2 shadow-lift tap-scale disabled:opacity-50">
              <Sparkles className="size-4" /> Enter LifeUpdate
            </button>
          ) : (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext} className="rounded-full bg-foreground text-background px-6 h-11 inline-flex items-center gap-2 shadow-lift tap-scale disabled:opacity-40">
              Continue <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
