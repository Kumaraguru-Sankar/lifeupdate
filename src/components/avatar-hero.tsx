import { useMemo } from "react";

// Infinite leveling curve: total XP required to reach level n = 3 * n^2
// So level from xp = floor(sqrt(xp / 3))
export function deriveLevel(xp: number) {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 3));
  const currentBase = 3 * level * level;
  const nextBase = 3 * (level + 1) * (level + 1);
  const into = xp - currentBase;
  const span = nextBase - currentBase;
  return {
    level,
    into,
    span,
    progress: Math.min(1, Math.max(0, into / span)),
    toNext: Math.max(0, span - into),
  };
}

/**
 * A calm, minimal line-art human figure that grows broader / more muscular
 * as the level increases. Level 0 is a slender beginner; growth is unbounded
 * but tapers smoothly so the silhouette stays elegant at every stage.
 */
export function AvatarHero({ level, className }: { level: number; className?: string }) {
  const m = useMemo(() => {
    // smooth, saturating growth factor 0 → ~1
    const g = 1 - 1 / (1 + level / 8);
    const shoulder = 38 + g * 58;       // 38 → ~96
    const bicep = 5 + g * 12;           // arm thickness
    const chest = 32 + g * 40;          // torso width at chest
    const waist = 24 + g * 18;          // torso width at waist
    const neck = 8 + g * 5;
    const auraCount = Math.min(4, Math.floor(level / 5));
    return { g, shoulder, bicep, chest, waist, neck, auraCount };
  }, [level]);

  const cx = 110;
  const headR = 18;
  const headCy = 38;
  const shoulderY = 70;
  const chestY = 100;
  const waistY = 140;
  const hipY = 158;
  const footY = 232;

  return (
    <svg
      viewBox="0 0 220 250"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Aura rings — appear every 5 levels */}
      {Array.from({ length: m.auraCount }).map((_, i) => (
        <ellipse
          key={i}
          cx={cx}
          cy={135}
          rx={70 + i * 10}
          ry={108 + i * 10}
          className="text-accent/15"
          stroke="currentColor"
          strokeWidth={0.6}
        />
      ))}

      {/* Head */}
      <circle cx={cx} cy={headCy} r={headR} />

      {/* Neck */}
      <path d={`M ${cx - m.neck} ${headCy + headR - 2} Q ${cx} ${shoulderY - 6} ${cx + m.neck} ${headCy + headR - 2}`} />

      {/* Shoulders + torso silhouette */}
      <path
        d={`
          M ${cx - m.shoulder} ${shoulderY}
          C ${cx - m.shoulder} ${chestY - 10}, ${cx - m.chest} ${chestY}, ${cx - m.chest} ${chestY + 6}
          L ${cx - m.waist} ${waistY}
          L ${cx - m.waist + 4} ${hipY}
          L ${cx + m.waist - 4} ${hipY}
          L ${cx + m.waist} ${waistY}
          L ${cx + m.chest} ${chestY + 6}
          C ${cx + m.chest} ${chestY}, ${cx + m.shoulder} ${chestY - 10}, ${cx + m.shoulder} ${shoulderY}
          Z
        `}
      />

      {/* Chest line */}
      <path d={`M ${cx - m.chest * 0.55} ${chestY + 4} Q ${cx} ${chestY + 14} ${cx + m.chest * 0.55} ${chestY + 4}`} className="text-foreground/40" />

      {/* Sternum hint at higher levels */}
      {m.g > 0.35 && (
        <path d={`M ${cx} ${chestY + 4} L ${cx} ${waistY - 8}`} className="text-foreground/30" />
      )}

      {/* Left arm with bicep */}
      <path
        d={`
          M ${cx - m.shoulder + 2} ${shoulderY + 4}
          C ${cx - m.shoulder - m.bicep} ${shoulderY + 26}, ${cx - m.shoulder - m.bicep} ${shoulderY + 40}, ${cx - m.shoulder + 2} ${shoulderY + 58}
          L ${cx - m.shoulder + 6} ${shoulderY + 88}
        `}
      />
      {/* Left forearm */}
      <path d={`M ${cx - m.shoulder + 6} ${shoulderY + 88} L ${cx - m.shoulder + 4} ${shoulderY + 120}`} />

      {/* Right arm with bicep */}
      <path
        d={`
          M ${cx + m.shoulder - 2} ${shoulderY + 4}
          C ${cx + m.shoulder + m.bicep} ${shoulderY + 26}, ${cx + m.shoulder + m.bicep} ${shoulderY + 40}, ${cx + m.shoulder - 2} ${shoulderY + 58}
          L ${cx + m.shoulder - 6} ${shoulderY + 88}
        `}
      />
      {/* Right forearm */}
      <path d={`M ${cx + m.shoulder - 6} ${shoulderY + 88} L ${cx + m.shoulder - 4} ${shoulderY + 120}`} />

      {/* Legs */}
      <path d={`M ${cx - m.waist + 6} ${hipY} L ${cx - 14} ${footY}`} />
      <path d={`M ${cx + m.waist - 6} ${hipY} L ${cx + 14} ${footY}`} />

      {/* Ground line */}
      <path d={`M ${cx - 36} ${footY + 2} L ${cx + 36} ${footY + 2}`} className="text-foreground/20" />
    </svg>
  );
}
