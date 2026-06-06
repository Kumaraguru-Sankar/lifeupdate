import { PRESETS, type Period, type PeriodPreset } from "@/lib/period";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<Date | undefined>(value.preset === "custom" ? new Date(value.from) : undefined);
  const [to, setTo] = useState<Date | undefined>(value.preset === "custom" ? new Date(value.to) : undefined);

  const select = (id: PeriodPreset) => {
    if (id === "custom") { setOpen(true); return; }
    onChange({ preset: id });
  };

  const apply = () => {
    if (!from || !to) return;
    onChange({ preset: "custom", from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") });
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
      {PRESETS.map((p) => {
        const active = value.preset === p.id;
        if (p.id === "custom") {
          return (
            <Popover key={p.id} open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <button
                  onClick={() => select(p.id)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border-[2px] border-[var(--nb-ink)] whitespace-nowrap transition-all",
                    active ? "bg-[var(--nb-yellow)] text-[var(--nb-ink)] nb-shadow" : "bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  <CalendarIcon className="size-3" strokeWidth={3} />
                  {active && value.preset === "custom"
                    ? `${value.from.slice(5)} → ${value.to.slice(5)}`
                    : "Custom"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3 pointer-events-auto" align="end">
                <div className="text-[10px] uppercase tracking-widest font-black mb-1">From</div>
                <Calendar mode="single" selected={from} onSelect={setFrom} className="pointer-events-auto" />
                <div className="text-[10px] uppercase tracking-widest font-black mt-3 mb-1">To</div>
                <Calendar mode="single" selected={to} onSelect={setTo} className="pointer-events-auto" />
                <button
                  onClick={apply}
                  disabled={!from || !to}
                  className="mt-3 w-full rounded-lg bg-[var(--nb-ink)] text-white py-2 text-xs font-black uppercase tracking-wider border-[2px] border-[var(--nb-ink)] nb-shadow disabled:opacity-50"
                >Apply</button>
              </PopoverContent>
            </Popover>
          );
        }
        return (
          <button
            key={p.id}
            onClick={() => select(p.id)}
            className={cn(
              "px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border-[2px] border-[var(--nb-ink)] whitespace-nowrap transition-all",
              active ? "bg-[var(--nb-yellow)] text-[var(--nb-ink)] nb-shadow" : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
