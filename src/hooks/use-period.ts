import { useEffect, useState } from "react";
import type { Period } from "@/lib/period";

const KEY = (scope: string) => `lu_period_${scope}`;

export function usePeriod(scope: string, initial: Period = { preset: "30d" }) {
  const [period, setPeriod] = useState<Period>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = localStorage.getItem(KEY(scope));
      return raw ? (JSON.parse(raw) as Period) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY(scope), JSON.stringify(period)); } catch { /* noop */ }
  }, [scope, period]);
  return [period, setPeriod] as const;
}
