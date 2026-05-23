import { cn } from "@/lib/utils";

export function ProgressRing({
  value,
  size = 96,
  stroke = 10,
  className,
  trackClass = "stroke-foreground/10",
  strokeClass = "stroke-[url(#ringGrad)]",
  children,
  gradFrom = "var(--c-sky)",
  gradTo = "var(--c-lilac)",
}: {
  value: number; // 0..100
  size?: number;
  stroke?: number;
  className?: string;
  trackClass?: string;
  strokeClass?: string;
  children?: React.ReactNode;
  gradFrom?: string;
  gradTo?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;
  const gid = `g-${gradFrom}-${gradTo}`.replace(/[^a-z0-9]/gi, "");
  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradFrom} />
            <stop offset="100%" stopColor={gradTo} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className={trackClass} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke={`url(#${gid})`}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
