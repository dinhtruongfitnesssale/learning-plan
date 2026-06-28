import { COLORS } from "@/lib/brand";
import type { Accent } from "@/lib/supabase/types";

const accentColor: Record<Accent, string> = {
  amber: COLORS.amber,
  herb: COLORS.herb,
  slate: COLORS.slate,
  clay: COLORS.clay,
};

// Vòng tiến độ — tận dụng khát khao "hoàn thiện mô hình chưa xong" (Gestalt).
export function ProgressRing({
  value, // 0..1
  size = 72,
  stroke = 7,
  accent = "herb",
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  accent?: Accent;
  label?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const offset = c * (1 - pct);
  const done = pct >= 1;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={COLORS.ink}
          strokeOpacity={0.1}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={done ? COLORS.herb : accentColor[accent]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <span className="absolute font-mono text-sm font-semibold tnum text-ink">
        {label ?? `${Math.round(pct * 100)}%`}
      </span>
    </div>
  );
}
