import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DAY_LABELS, type HabitRow } from "@/lib/habit-schedule";

export type HabitDraft = {
  name: string;
  frequency: "daily" | "weekdays" | "custom";
  custom_days: number[];
  start_date: string;
  end_date: string | null;
  reminder_time: string | null;
};

export function HabitEditor({
  open,
  initial,
  title,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: Partial<HabitRow>;
  title: string;
  onClose: () => void;
  onSave: (d: HabitDraft) => void;
}) {
  const [d, setD] = useState<HabitDraft>(() => blank(initial));

  useEffect(() => { if (open) setD(blank(initial)); }, [open, initial]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6 bg-[var(--nb-ink)]/50 overscroll-contain" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[85dvh] overflow-y-auto rounded-2xl bg-card border-[3px] border-[var(--nb-ink)] nb-shadow-lg p-4 space-y-4"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-2xl leading-none">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="grid place-items-center size-9 rounded-xl border-[2.5px] border-[var(--nb-ink)] bg-white tap-scale">
            <X className="size-4" strokeWidth={3} />
          </button>
        </div>

        <Field label="Habit name">
          <input
            autoFocus
            value={d.name}
            onChange={e => setD({ ...d, name: e.target.value })}
            placeholder="e.g. Study 1 hour"
            className="w-full rounded-xl border-[2.5px] border-[var(--nb-ink)] bg-background px-3 py-2.5 text-sm font-semibold outline-none"
          />
        </Field>

        <Field label="Frequency">
          <div className="grid grid-cols-3 gap-2">
            {(["daily", "weekdays", "custom"] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setD({ ...d, frequency: f })}
                className={cn(
                  "rounded-xl border-[2.5px] border-[var(--nb-ink)] py-2 text-xs font-black uppercase tracking-wider tap-scale",
                  d.frequency === f ? "bg-[var(--nb-blue)] text-white nb-shadow" : "bg-white text-[var(--nb-ink)]"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          {d.frequency === "custom" && (
            <div className="mt-2 grid grid-cols-7 gap-1.5">
              {DAY_LABELS.map((lbl, i) => {
                const on = d.custom_days.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Day ${i}`}
                    onClick={() => setD({ ...d, custom_days: on ? d.custom_days.filter(x => x !== i) : [...d.custom_days, i] })}
                    className={cn(
                      "aspect-square rounded-lg border-[2.5px] border-[var(--nb-ink)] text-xs font-black tap-scale",
                      on ? "bg-[var(--nb-green)]" : "bg-white"
                    )}
                  >{lbl}</button>
                );
              })}
            </div>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input type="date" value={d.start_date} onChange={e => setD({ ...d, start_date: e.target.value })}
              className="w-full rounded-xl border-[2.5px] border-[var(--nb-ink)] bg-background px-2.5 py-2 text-xs font-semibold outline-none" />
          </Field>
          <Field label="End date">
            <input type="date" value={d.end_date ?? ""} onChange={e => setD({ ...d, end_date: e.target.value || null })}
              className="w-full rounded-xl border-[2.5px] border-[var(--nb-ink)] bg-background px-2.5 py-2 text-xs font-semibold outline-none" />
          </Field>
        </div>

        <Field label="Reminder">
          <input type="time" value={d.reminder_time ?? ""} onChange={e => setD({ ...d, reminder_time: e.target.value || null })}
            className="w-full rounded-xl border-[2.5px] border-[var(--nb-ink)] bg-background px-2.5 py-2 text-xs font-semibold outline-none" />
        </Field>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 rounded-xl border-[2.5px] border-[var(--nb-ink)] bg-white py-2.5 text-sm font-black tap-scale">Cancel</button>
          <button
            onClick={() => { if (d.name.trim()) onSave({ ...d, name: d.name.trim() }); }}
            className="flex-1 rounded-xl border-[2.5px] border-[var(--nb-ink)] bg-[var(--nb-blue)] text-white py-2.5 text-sm font-black nb-shadow tap-scale"
          >Save</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-black mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function blank(initial?: Partial<HabitRow>): HabitDraft {
  const today = new Date();
  const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return {
    name: initial?.name ?? "",
    frequency: (initial?.frequency as HabitDraft["frequency"]) ?? "daily",
    custom_days: initial?.custom_days ?? [],
    start_date: initial?.start_date ?? iso,
    end_date: initial?.end_date ?? null,
    reminder_time: initial?.reminder_time ?? null,
  };
}
