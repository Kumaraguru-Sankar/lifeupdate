// Tiny inline SVG charts — no chart library.

export function Sparkline({ values, height = 48, color = "var(--nb-ink)", fill = false }: {
  values: number[]; height?: number; color?: string; fill?: boolean;
}) {
  if (!values.length) return <div style={{ height }} className="opacity-40" />;
  const w = 100, h = height;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => `${i * step},${h - ((v - min) / span) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {fill && (
        <polygon points={`0,${h} ${pts} ${w},${h}`} fill={color} opacity="0.18" />
      )}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Bars({ values, labels, height = 80, color = "var(--nb-ink)" }: {
  values: number[]; labels?: string[]; height?: number; color?: string;
}) {
  if (!values.length) return <div style={{ height }} className="opacity-40" />;
  const max = Math.max(...values, 1);
  return (
    <div className="w-full" style={{ height }}>
      <div className="flex items-end gap-1 h-full">
        {values.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="w-full rounded-t-md border-[2px] border-b-0 border-[var(--nb-ink)] transition-all"
              style={{ height: `${Math.max(2, (v / max) * 100)}%`, background: color, opacity: v === 0 ? 0.2 : 1 }} />
            {labels && <span className="text-[8px] text-muted-foreground font-bold truncate w-full text-center">{labels[i]}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
