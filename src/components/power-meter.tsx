import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AvatarHero, deriveLevel } from "./avatar-hero";

export function PowerMeter() {
  const tasksDoneQ = useQuery({
    queryKey: ["xp", "tasks_done_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("completed", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const habitLogsQ = useQuery({
    queryKey: ["xp", "habit_logs_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("habit_logs")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const xp = (tasksDoneQ.data ?? 0) + (habitLogsQ.data ?? 0);
  const { level, into, span, progress, toNext } = deriveLevel(xp);

  return (
    <section className="mb-8 rounded-3xl bg-card border border-border/60 overflow-hidden">
      <div className="grid grid-cols-[auto_1fr] gap-4 p-5 md:p-6">
        <div className="relative w-[120px] md:w-[140px] aspect-[220/250] text-foreground">
          <AvatarHero level={level} className="w-full h-full transition-all duration-700 ease-out" />
        </div>

        <div className="flex flex-col justify-center min-w-0">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Power level</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-display text-5xl leading-none">{level}</span>
            <span className="text-xs text-muted-foreground">/ ∞</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            {level === 0
              ? "Complete a task or habit to begin growing."
              : `${toNext} more to reach level ${level + 1}.`}
          </p>

          <div className="mt-4">
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-accent transition-[width] duration-700 ease-out"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground tracking-wide">
              <span>{into} xp</span>
              <span>{span} xp</span>
            </div>
          </div>

          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-4">
            {xp} total · tasks + habits
          </p>
        </div>
      </div>
    </section>
  );
}
