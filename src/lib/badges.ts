import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type Badge = { id: string; badge_key: string; label: string; emoji: string; earned_at: string };

export type BadgeDef = { key: string; label: string; emoji: string; check: (s: SyncStats) => boolean };

export type SyncStats = {
  tasksDone: number;
  habitsCount: number;
  habitLogsTotal: number;
  loginStreak: number;
  habitStreak: number;
  pomodoros: number;
};

export const BADGE_DEFS: BadgeDef[] = [
  { key: "first_task",      label: "First Step",       emoji: "🌱", check: s => s.tasksDone >= 1 },
  { key: "tasks_10",        label: "Ten Done",         emoji: "✅", check: s => s.tasksDone >= 10 },
  { key: "tasks_50",        label: "Half Century",     emoji: "🚀", check: s => s.tasksDone >= 50 },
  { key: "tasks_100",       label: "Centurion",        emoji: "🏆", check: s => s.tasksDone >= 100 },
  { key: "first_habit",     label: "Habit Sprout",     emoji: "🌿", check: s => s.habitsCount >= 1 },
  { key: "habits_5",        label: "Routine Builder",  emoji: "🌳", check: s => s.habitsCount >= 5 },
  { key: "habit_log_30",    label: "Thirty Check-ins", emoji: "🪴", check: s => s.habitLogsTotal >= 30 },
  { key: "habit_log_100",   label: "Hundred Check-ins",emoji: "💚", check: s => s.habitLogsTotal >= 100 },
  { key: "habit_streak_3",  label: "3-Day Streak",     emoji: "🔥", check: s => s.habitStreak >= 3 },
  { key: "habit_streak_7",  label: "Week Warrior",     emoji: "✨", check: s => s.habitStreak >= 7 },
  { key: "habit_streak_30", label: "Month Master",     emoji: "🏔",  check: s => s.habitStreak >= 30 },
  { key: "login_streak_3",  label: "Showing Up",       emoji: "👋", check: s => s.loginStreak >= 3 },
  { key: "login_streak_7",  label: "Loyal Visitor",    emoji: "💎", check: s => s.loginStreak >= 7 },
  { key: "login_streak_30", label: "Devoted",          emoji: "👑", check: s => s.loginStreak >= 30 },
  { key: "focus_5",         label: "Focused",          emoji: "⏱", check: s => s.pomodoros >= 5 },
  { key: "focus_25",        label: "Deep Worker",      emoji: "🧠", check: s => s.pomodoros >= 25 },
];

const LOGIN_KEY = "lifeupdate.loginDays";

export function recordLoginToday(): number {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem(LOGIN_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    if (!arr.includes(today)) arr.push(today);
    const last90 = arr.slice(-180).sort();
    localStorage.setItem(LOGIN_KEY, JSON.stringify(last90));
    // compute streak
    const set = new Set(last90);
    let streak = 0;
    const cur = new Date();
    if (!set.has(today)) cur.setDate(cur.getDate() - 1);
    for (let i = 0; i < 365; i++) {
      const d = cur.toISOString().slice(0, 10);
      if (set.has(d)) { streak += 1; cur.setDate(cur.getDate() - 1); } else break;
    }
    return streak;
  } catch { return 0; }
}

export async function syncBadges() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);

  const [tasksR, habitsR, logsR, pomR, existingR] = await Promise.all([
    supabase.from("tasks").select("id").eq("completed", true),
    supabase.from("habits").select("id"),
    supabase.from("habit_logs").select("date").gte("date", since),
    supabase.from("pomodoro_sessions").select("id"),
    supabase.from("user_badges").select("badge_key"),
  ]);

  const habitLogs = logsR.data ?? [];
  const dateSet = new Set(habitLogs.map((l: any) => l.date));
  let habitStreak = 0;
  const cur = new Date();
  if (!dateSet.has(today)) cur.setDate(cur.getDate() - 1);
  for (let i = 0; i < 365; i++) {
    const d = cur.toISOString().slice(0, 10);
    if (dateSet.has(d)) { habitStreak += 1; cur.setDate(cur.getDate() - 1); } else break;
  }

  const stats: SyncStats = {
    tasksDone: tasksR.data?.length ?? 0,
    habitsCount: habitsR.data?.length ?? 0,
    habitLogsTotal: habitLogs.length,
    pomodoros: pomR.data?.length ?? 0,
    habitStreak,
    loginStreak: recordLoginToday(),
  };

  const owned = new Set((existingR.data ?? []).map((b: any) => b.badge_key));
  const newly = BADGE_DEFS.filter(b => b.check(stats) && !owned.has(b.key));
  if (newly.length) {
    await supabase.from("user_badges").insert(
      newly.map(b => ({ user_id: user.id, badge_key: b.key, label: b.label, emoji: b.emoji }))
    );
    for (const b of newly) {
      toast.success(`${b.emoji} Badge unlocked: ${b.label}`, { duration: 4500 });
    }
  }
  return newly;
}

export function useBadges() {
  return useQuery({
    queryKey: ["user_badges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_badges")
        .select("*")
        .order("earned_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Badge[];
    },
  });
}

/** Hook factory: call after a mutation success to re-evaluate badges. */
export function useBadgeSyncer() {
  const qc = useQueryClient();
  return async () => {
    const newly = await syncBadges();
    if (newly.length) qc.invalidateQueries({ queryKey: ["user_badges"] });
  };
}
