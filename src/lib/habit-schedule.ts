export type Frequency = "daily" | "weekdays" | "custom";

export type HabitRow = {
  id: string;
  name: string;
  goal_id: string | null;
  frequency: string;
  custom_days: number[] | null;
  start_date: string;
  end_date: string | null;
  reminder_time: string | null;
  archived: boolean;
  sort_order: number;
};

export const isoDay = (d: Date) => {
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return t.toISOString().slice(0, 10);
};

/** Is this habit scheduled on the given ISO date? */
export function isScheduled(h: Pick<HabitRow, "frequency" | "custom_days" | "start_date" | "end_date">, iso: string) {
  if (h.start_date && iso < h.start_date) return false;
  if (h.end_date && iso > h.end_date) return false;
  const dow = new Date(`${iso}T00:00:00`).getDay(); // 0 Sun … 6 Sat
  if (h.frequency === "weekdays") return dow >= 1 && dow <= 5;
  if (h.frequency === "custom") return (h.custom_days ?? []).includes(dow);
  return true;
}

export function scheduledDates(h: Parameters<typeof isScheduled>[0], fromIso: string, toIso: string) {
  const out: string[] = [];
  const d = new Date(`${fromIso}T00:00:00`);
  const end = new Date(`${toIso}T00:00:00`);
  while (d <= end) {
    const iso = isoDay(d);
    if (isScheduled(h, iso)) out.push(iso);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** current + best streak over scheduled days, most recent first */
export function streaks(scheduled: string[], doneSet: Set<string>, todayIso: string) {
  let current = 0;
  let best = 0;
  let run = 0;
  for (const iso of scheduled) {
    if (doneSet.has(iso)) run += 1;
    else run = 0;
    best = Math.max(best, run);
  }
  for (let i = scheduled.length - 1; i >= 0; i--) {
    const iso = scheduled[i];
    if (doneSet.has(iso)) current += 1;
    else if (iso === todayIso) continue; // today still open
    else break;
  }
  return { current, best };
}

export const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function frequencyLabel(h: Pick<HabitRow, "frequency" | "custom_days">) {
  if (h.frequency === "weekdays") return "Weekdays";
  if (h.frequency === "custom") {
    const days = (h.custom_days ?? []).slice().sort();
    if (days.length === 0) return "Custom";
    return days.map(d => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(" ");
  }
  return "Daily";
}
