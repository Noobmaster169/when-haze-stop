import type { StationOutlook } from "@/lib/api/haze-schemas";
import { malaysiaDay, malaysiaMidnights } from "@/lib/malaysia-time";

/**
 * A station's week and the days ahead as one line: solid where it was read,
 * dashed where it is forecast, against the two lines people ask about.
 */

const WIDTH = 308;
const HEIGHT = 150;
const LEFT = 26;
const RIGHT = 6;
const TOP = 8;
const BOTTOM = 20;
const LINES = [100, 180];

export function OutlookChart({ outlook, at }: { outlook: StationOutlook; at: number }) {
  const read = outlook.readings.map((point) => ({ at: Date.parse(point.at), api: point.api }));
  const ahead = outlook.forecast.map((point) => ({ at: Date.parse(point.at), api: point.api }));
  const all = [...read, ...ahead];
  if (all.length < 2) return null;

  const from = all[0].at;
  const to = all[all.length - 1].at;
  const top = Math.max(200, Math.ceil(Math.max(...all.map((point) => point.api)) / 50) * 50);
  const x = (moment: number): number => LEFT + ((moment - from) / (to - from)) * (WIDTH - LEFT - RIGHT);
  const y = (api: number): number => TOP + (1 - api / top) * (HEIGHT - TOP - BOTTOM);
  const path = (points: { at: number; api: number }[]): string => points.map((point, index) => `${index === 0 ? "M" : "L"}${x(point.at).toFixed(1)},${y(point.api).toFixed(1)}`).join("");
  const last = read[read.length - 1];
  const cursor = Math.max(from, Math.min(to, at));
  // Every other midnight is named, so ten days of names do not collide.
  const midnights = malaysiaMidnights(from, to);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label={`API at ${outlook.station.name} over the past week and the next three days`}>
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
      <text x={WIDTH - RIGHT} y={y(180) - 3} textAnchor="end" fontSize="9.5" fill="var(--verdict-fault)">
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
      <path d={path(read)} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
      {last && ahead.length > 0 ? <path d={path([last, ...ahead])} fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeDasharray="4 3" strokeLinejoin="round" /> : null}
      <line x1={x(cursor)} x2={x(cursor)} y1={TOP} y2={HEIGHT - BOTTOM} stroke="var(--ink-tertiary)" strokeWidth="1" />
    </svg>
  );
}
