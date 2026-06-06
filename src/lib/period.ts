// Time-period filter primitives used across modules.

export type PeriodPreset = "today" | "7d" | "30d" | "90d" | "6m" | "1y" | "all" | "custom";

export type Period =
  | { preset: Exclude<PeriodPreset, "custom"> }
  | { preset: "custom"; from: string; to: string };

export const PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
  { id: "6m", label: "6m" },
  { id: "1y", label: "1y" },
  { id: "all", label: "All" },
  { id: "custom", label: "Custom" },
];

const toISO = (d: Date) => d.toISOString().slice(0, 10);
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };

export function rangeFor(p: Period): { from: string; to: string; days: number } {
  const today = startOfDay(new Date());
  const toExclusive = new Date(today); toExclusive.setDate(toExclusive.getDate() + 1);
  if (p.preset === "custom") {
    const toEx = new Date(p.to); toEx.setDate(toEx.getDate() + 1);
    const days = Math.max(1, Math.round((toEx.getTime() - new Date(p.from).getTime()) / 86400000));
    return { from: p.from, to: toISO(toEx), days };
  }
  const back = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n + 1); return d; };
  switch (p.preset) {
    case "today": return { from: toISO(today), to: toISO(toExclusive), days: 1 };
    case "7d":    return { from: toISO(back(7)), to: toISO(toExclusive), days: 7 };
    case "30d":   return { from: toISO(back(30)), to: toISO(toExclusive), days: 30 };
    case "90d":   return { from: toISO(back(90)), to: toISO(toExclusive), days: 90 };
    case "6m":    return { from: toISO(back(180)), to: toISO(toExclusive), days: 180 };
    case "1y":    return { from: toISO(back(365)), to: toISO(toExclusive), days: 365 };
    case "all":   return { from: "1970-01-01", to: toISO(toExclusive), days: 100000 };
  }
}

export function previousRange(p: Period) {
  const r = rangeFor(p);
  const from = new Date(r.from); const to = new Date(r.to);
  const span = to.getTime() - from.getTime();
  const prevTo = from;
  const prevFrom = new Date(from.getTime() - span);
  return { from: toISO(prevFrom), to: toISO(prevTo), days: r.days };
}

export function inRange(dateStr: string | null | undefined, r: { from: string; to: string }) {
  if (!dateStr) return false;
  return dateStr >= r.from && dateStr < r.to;
}

export function bucketsFor(p: Period): { keys: string[]; label: (k: string) => string } {
  const r = rangeFor(p);
  const keys: string[] = [];
  if (r.days <= 31) {
    // daily
    const d = new Date(r.from);
    while (toISO(d) < r.to) { keys.push(toISO(d)); d.setDate(d.getDate() + 1); }
    return { keys, label: (k) => new Date(k).toLocaleDateString(undefined, { day: "numeric", month: "short" }) };
  }
  if (r.days <= 200) {
    // weekly
    const d = new Date(r.from);
    while (toISO(d) < r.to) { keys.push(toISO(d)); d.setDate(d.getDate() + 7); }
    return { keys, label: (k) => new Date(k).toLocaleDateString(undefined, { day: "numeric", month: "short" }) };
  }
  // monthly
  const d = new Date(r.from); d.setDate(1);
  while (toISO(d) < r.to) { keys.push(toISO(d)); d.setMonth(d.getMonth() + 1); }
  return { keys, label: (k) => new Date(k).toLocaleDateString(undefined, { month: "short", year: "2-digit" }) };
}

export function bucketKey(dateStr: string, p: Period): string {
  const r = rangeFor(p);
  if (r.days <= 31) return dateStr;
  if (r.days <= 200) {
    // week start
    const d = new Date(dateStr);
    const from = new Date(r.from);
    const diff = Math.floor((d.getTime() - from.getTime()) / 86400000);
    const weekStart = new Date(from); weekStart.setDate(from.getDate() + Math.floor(diff / 7) * 7);
    return toISO(weekStart);
  }
  // monthly
  return dateStr.slice(0, 7) + "-01";
}
