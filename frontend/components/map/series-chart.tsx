import { malaysiaDay, malaysiaMidnights } from "@/lib/malaysia-time";

/**
 * A place's week and the days ahead as one line: solid where it is known,
 * dashed where it is forecast, against the two lines people ask about. A
 * cursor with a dot on the line follows the timeline, so the chart moves as
 * the map plays.
 */

export interface SeriesPoint {
  at: number;
  api: number;
}

const WIDTH = 308;
const HEIGHT = 156;
const LEFT = 26;
const RIGHT = 6;
const TOP = 12;
const BOTTOM = 20;
const LINES = [100, 180];

/** The line's value at a moment, straight between the points either side. */
function valueOn(points: SeriesPoint[], at: number): number | null {
  if (points.length === 0) return null;
  if (at <= points[0].at) return points[0].api;
  for (let index = 1; index < points.length; index++) {
    const after = points[index];
    if (at <= after.at) {
      const before = points[index - 1];
      return before.api + ((at - before.at) / (after.at - before.at)) * (after.api - before.api);
    }
  }
  return points[points.length - 1].api;
}

export function SeriesChart({ known, ahead, at, label }: { known: SeriesPoint[]; ahead: SeriesPoint[]; at: number; label: string }) {
  const all = [...known, ...ahead];
  if (all.length < 2) return null;

  const from = all[0].at;
  const to = all[all.length - 1].at;
  const top = Math.max(200, Math.ceil(Math.max(...all.map((point) => point.api)) / 50) * 50);
  const x = (moment: number): number => LEFT + ((moment - from) / (to - from)) * (WIDTH - LEFT - RIGHT);
  const y = (api: number): number => TOP + (1 - api / top) * (HEIGHT - TOP - BOTTOM);
  const path = (points: SeriesPoint[]): string => points.map((point, index) => `${index === 0 ? "M" : "L"}${x(point.at).toFixed(1)},${y(point.api).toFixed(1)}`).join("");
  const last = known[known.length - 1];
  const cursor = Math.max(from, Math.min(to, at));
  const cursorValue = valueOn(last && ahead.length > 0 ? [...known, ...ahead] : all, cursor);
  const forecasting = last !== undefined && cursor > last.at;
  // Every other midnight is named, so ten days of names do not collide.
  const midnights = malaysiaMidnights(from, to);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label={label}>
      {[0, 100, 200, 300, 400].filter((value) => value <= top).map((value) => (
        <g key={value}>
          <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(value)} y2={y(value)} stroke="var(--hairline)" />
          <text x={LEFT - 5} y={y(value) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--ink-faint)">
            {value}
          </text>
        </g>
      ))}
      {LINES.map((value) => (
        <line key={value} x1={LEFT} x2={WIDTH - RIGHT} y1={y(value)} y2={y(value)} stroke={value === 180 ? "var(--verdict-fault)" : "var(--verdict-differ)"} strokeDasharray="3 3" strokeWidth="1" />
      ))}
      <text x={LEFT + 3} y={y(180) - 3} fontSize="9.5" fill="var(--verdict-fault)">
        180, schools close
      </text>
      {midnights.map((midnight, index) => (
        <g key={midnight}>
          <line x1={x(midnight)} x2={x(midnight)} y1={HEIGHT - BOTTOM} y2={HEIGHT - BOTTOM + 3} stroke="var(--hairline-strong)" />
          {index % 2 === 0 ? (
            <text x={x(midnight) + 2} y={HEIGHT - 5} fontSize="9.5" fill="var(--ink-tertiary)">
              {malaysiaDay(midnight)}
            </text>
          ) : null}
        </g>
      ))}
      {last && ahead.length > 0 ? (
        <g>
          <line x1={x(last.at)} x2={x(last.at)} y1={TOP} y2={HEIGHT - BOTTOM} stroke="var(--accent)" strokeWidth="1" opacity="0.5" />
          <text x={x(last.at) + 3} y={TOP - 3} fontSize="9" fill="var(--accent)">
            Now
          </text>
        </g>
      ) : null}
      <path d={path(known)} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
      {last && ahead.length > 0 ? <path d={path([last, ...ahead])} fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeDasharray="4 3" strokeLinejoin="round" /> : null}
      <line x1={x(cursor)} x2={x(cursor)} y1={TOP} y2={HEIGHT - BOTTOM} stroke="var(--ink-tertiary)" strokeWidth="1" />
      {cursorValue !== null ? <circle cx={x(cursor)} cy={y(cursorValue)} r="4" fill={forecasting ? "var(--accent)" : "var(--ink)"} stroke="var(--canvas)" strokeWidth="1.5" /> : null}
    </svg>
  );
}
