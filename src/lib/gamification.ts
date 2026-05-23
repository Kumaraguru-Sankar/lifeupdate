import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export type GameStats = {
  xp: number;
  level: number;
  xpInLevel: number;
  xpForNextLevel: number;
  progress: number; // 0..1 within current level
  streak: number;
  todayScore: number; // 0..100
  badges: string[];
};

const LEVEL_STEP = 200; // XP per level

function computeLevel(xp: number) {
  const level = Math.floor(xp / LEVEL_STEP) + 1;
  const xpInLevel = xp - (level - 1) * LEVEL_STEP;
  return { level, xpInLevel, xpForNextLevel: LEVEL_STEP, progress: xpInLevel / LEVEL_STEP };
}

export function useGameStats() {
  return useQuery({
    queryKey: ["game_stats"],
    queryFn: async (): Promise<GameStats> => {
      const today = new Date().toISOString().slice(0, 10);
      const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

      const [tasksR, habitsR, logsR, todayLogsR, pomR] = await Promise.all([
        supabase.from("tasks").select("id, completed, updated_at").eq("completed", true),
        supabase.from("habits").select("id"),
        supabase.from("habit_logs").select("date").gte("date", since),
        supabase.from("habit_logs").select("habit_id").eq("date", today),
        supabase.from("pomodoro_sessions").select("id, completed_at"),
      ]);

      const tasksDone = tasksR.data?.length ?? 0;
      const habitsTotal = habitsR.data?.length ?? 0;
      const habitLogs = logsR.data ?? [];
      const habitsDoneToday = todayLogsR.data?.length ?? 0;
      const pomDone = pomR.data?.length ?? 0;

      const xp = tasksDone * 8 + habitLogs.length * 12 + pomDone * 6;

      // Compute streak: consecutive days (going back from today) with ≥1 habit log
      const dateSet = new Set(habitLogs.map(l => l.date));
      let streak = 0;
      const cursor = new Date();
      // If nothing today, still allow streak from yesterday backwards
      if (!dateSet.has(today)) cursor.setDate(cursor.getDate() - 1);
      for (let i = 0; i < 365; i++) {
        const d = cursor.toISOString().slice(0, 10);
        if (dateSet.has(d)) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
        else break;
      }

      const todayScore = Math.min(100, Math.round(
        (habitsTotal > 0 ? (habitsDoneToday / habitsTotal) * 60 : 30) +
        Math.min(40, pomDone * 4)
      ));

      const badges: string[] = [];
      if (streak >= 3) badges.push("🔥 3-day streak");
      if (streak >= 7) badges.push("✨ Week warrior");
      if (streak >= 30) badges.push("🏔 Month master");
      if (tasksDone >= 10) badges.push("✅ 10 tasks");
      if (tasksDone >= 50) badges.push("🚀 50 tasks");
      if (pomDone >= 5) badges.push("⏱ Focused");

      return { xp, ...computeLevel(xp), streak, todayScore, badges };
    },
    staleTime: 30_000,
  });
}

export const MOTIVATION = [
  "Small steps, big horizons.",
  "Showing up is the win.",
  "Be where your feet are.",
  "Gentle progress is still progress.",
  "Breathe. Begin. Become.",
  "Today is a soft start.",
  "Your future self is grateful.",
  "Calm minds move mountains.",
];

export function motivationOfDay() {
  const day = Math.floor(Date.now() / 86400000);
  return MOTIVATION[day % MOTIVATION.length];
}
