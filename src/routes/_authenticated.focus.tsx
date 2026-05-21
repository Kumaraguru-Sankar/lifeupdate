import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Pause, RotateCcw, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/focus")({ component: Focus });

const PRESETS = [
  { mode: "focus" as const, min: 25, label: "Focus" },
  { mode: "focus" as const, min: 50, label: "Deep" },
  { mode: "break" as const, min: 5, label: "Break" },
  { mode: "break" as const, min: 15, label: "Long break" },
];

function Focus() {
  const qc = useQueryClient();
  const [preset, setPreset] = useState(PRESETS[0]);
  const [secondsLeft, setSecondsLeft] = useState(PRESETS[0].min * 60);
  const [running, setRunning] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const totalRef = useRef(PRESETS[0].min * 60);

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("pomodoro_sessions").insert({ user_id: user.id, mode: preset.mode, duration_min: preset.min });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pomodoro"] }),
  });

  // pick preset
  const choose = (p: typeof PRESETS[number]) => {
    setPreset(p);
    setRunning(false);
    setSecondsLeft(p.min * 60);
    totalRef.current = p.min * 60;
  };

  // tick
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(id);
          setRunning(false);
          save.mutate();
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification("Session complete", { body: `${preset.label} · ${preset.min} min` });
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, preset.label, preset.min]);

  const toggle = () => {
    if (!running && secondsLeft === 0) setSecondsLeft(preset.min * 60);
    setRunning(r => !r);
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    startedAtRef.current = Date.now();
  };
  const reset = () => { setRunning(false); setSecondsLeft(preset.min * 60); };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const progress = 1 - secondsLeft / totalRef.current;

  // today's sessions
  const today = new Date().toISOString().slice(0, 10);
  const { data: sessions = [] } = useQuery({
    queryKey: ["pomodoro", today],
    queryFn: async () => {
      const start = today + "T00:00:00.000Z";
      const { data } = await supabase.from("pomodoro_sessions").select("mode,duration_min,completed_at").gte("completed_at", start).order("completed_at", { ascending: false });
      return data ?? [];
    },
  });
  const focusMinutes = useMemo(() => sessions.filter(s => s.mode === "focus").reduce((sum, s) => sum + (s.duration_min ?? 0), 0), [sessions]);

  const r = 130;
  const C = 2 * Math.PI * r;

  return (
    <AppShell title="Focus" subtitle={preset.label + " · " + preset.min + " min"}>
      <div className="flex flex-col items-center pt-2">
        <div className="relative w-[300px] h-[300px] grid place-items-center">
          <svg viewBox="0 0 300 300" className="absolute inset-0 -rotate-90">
            <circle cx="150" cy="150" r={r} stroke="currentColor" strokeWidth="6" className="text-muted/60" fill="none" />
            <circle
              cx="150" cy="150" r={r} stroke="currentColor" strokeWidth="6" fill="none"
              className="text-accent transition-all duration-1000 ease-out-soft"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              strokeLinecap="round"
            />
          </svg>
          <div className={cn("text-center", running && "animate-breathe")}>
            <div className="font-display text-7xl tabular-nums tracking-tight">{mm}:{ss}</div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mt-2">{preset.mode === "focus" ? "Deep work" : "Recover"}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-8">
          <button onClick={reset} className="size-12 rounded-full border border-border/60 grid place-items-center text-muted-foreground tap-scale"><RotateCcw className="size-4" /></button>
          <button onClick={toggle} className="size-16 rounded-full bg-foreground text-background grid place-items-center shadow-lift tap-scale">
            {running ? <Pause className="size-6" /> : <Play className="size-6 translate-x-0.5" />}
          </button>
          <button onClick={() => save.mutate()} className="size-12 rounded-full border border-border/60 grid place-items-center text-muted-foreground tap-scale" title="Log session">
            <Timer className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 w-full max-w-md mt-8">
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => choose(p)}
              className={cn(
                "rounded-xl px-2 py-3 border text-xs transition-all tap-scale",
                preset.label === p.label ? "bg-foreground text-background border-foreground" : "bg-card border-border/60 text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="font-medium">{p.label}</div>
              <div className="text-[10px] opacity-70">{p.min} min</div>
            </button>
          ))}
        </div>

        <div className="w-full max-w-md mt-10 rounded-2xl bg-card border border-border/60 p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Today</p>
            <p className="font-display text-3xl">{focusMinutes}<span className="text-xs text-muted-foreground"> min focused</span></p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{sessions.length} session{sessions.length === 1 ? "" : "s"} logged</p>
        </div>
      </div>
    </AppShell>
  );
}
