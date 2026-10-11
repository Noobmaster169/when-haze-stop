import type { DaySkill } from "@/lib/api/simulation-schemas";

/** Each day's forecasts on their own, so one good day cannot carry the week: amber left of grey is a day the forecast won. */

const WIDTH = 640;
const ROW = 22;
const LEFT = 64;
const RIGHT = 16;

export function DayChart({ days, lead }: { days: DaySkill[]; lead: number }) {
  if (days.length === 0) return null;
  const top = Math.ceil(Math.max(...days.map((day) => Math.max(day.model, day.persistence)))) + 1;
  const height = days.length * ROW + 24;
  const x = (value: number): number => LEFT + (value / top) * (WIDTH - LEFT - RIGHT);
  const label = (day: string): string => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} width="100%" role="img" aria-label={`Average miss ${lead} hours ahead, day by day`}>
      {days.map((day, index) => {
        const cy = index * ROW + 12;
        return (
          <g key={day.day}>
            <text x={LEFT - 10} y={cy + 4} textAnchor="end" fontSize="10.5" fill="var(--ink-tertiary)">
              {label(day.day)}
            </text>
            <line x1={x(day.model)} x2={x(day.persistence)} y1={cy} y2={cy} stroke="var(--hairline-strong)" strokeWidth="2" />
            <circle cx={x(day.persistence)} cy={cy} r="5" fill="var(--canvas)" stroke="var(--ink-tertiary)" strokeWidth="2">
              <title>{`${label(day.day)}: no change ${day.persistence.toFixed(2)}`}</title>
            </circle>
            <circle cx={x(day.model)} cy={cy} r="5" fill="var(--accent)" stroke="var(--canvas)" strokeWidth="2">
              <title>{`${label(day.day)}: forecast ${day.model.toFixed(2)}, ${day.cases.toLocaleString("en-GB")} cases`}</title>
            </circle>
          </g>
        );
      })}
      {[0, Math.round(top / 2), top].map((value) => (
        <text key={value} x={x(value)} y={height - 4} textAnchor="middle" fontSize="10" fill="var(--ink-faint)">
          {value}
        </text>
      ))}
    </svg>
  );
}
