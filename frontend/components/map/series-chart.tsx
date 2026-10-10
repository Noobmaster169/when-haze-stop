import { malaysiaDay, malaysiaMidnights } from "@/lib/malaysia-time";

/**
 * A place's week and the days ahead as one line: solid where it is known,
 * dashed where it is forecast, with each forecast day's likely peak range
 * shaded behind it. The legend is drawn in the lines' own strokes, so it is
 * right in either theme. A cursor follows the timeline, so the chart moves as
 * the map plays.
 */

export interface SeriesPoint {
  at: number;
  api: number;
}

/** A forecast day's likely peak, centred on that day's noon. */
export interface PeakRange {
  at: number;
  low: number;
  high: number;
}

const WIDTH = 308;
const HEIGHT = 166;
const LEFT = 26;
const RIGHT = 6;
const TOP = 24;
const BOTTOM = 20;
/** The official lines worth drawing, named where passing one means more than the axis says. */
const GUIDES: { value: number; note?: string }[] = [{ value: 100 }, { value: 180, note: "180 schools close" }];
/** The legend ends about here; a Now label left of it would collide. */
const LEGEND_END = LEFT + 150;
/** A day name needs this much room before the right edge, or it is left off. */
const LABEL_ROOM = 28;

export function SeriesChart({
  known,
  ahead,
  at,
  label,
  ranges = [],
  legend = { known: "Readings", ahead: "Forecast" },
}: {
  known: SeriesPoint[];
  ahead: SeriesPoint[];
  at: number;
  label: string;
  ranges?: PeakRange[];
  legend?: { known: string; ahead: string };
}) {
  const all = [...known, ...ahead];
  if (all.length < 2) return null;

  const from = all[0].at;
  const to = all[all.length - 1].at;
  const highest = Math.max(...all.map((point) => point.api), ...ranges.map((range) => range.high));
  const top = Math.max(200, Math.ceil(highest / 50) * 50);
  const x = (moment: number): number => LEFT + ((moment - from) / (to - from)) * (WIDTH - LEFT - RIGHT);
  const y = (api: number): number => TOP + (1 - api / top) * (HEIGHT - TOP - BOTTOM);
  const path = (points: SeriesPoint[]): string => points.map((point, index) => `${index === 0 ? "M" : "L"}${x(point.at).toFixed(1)},${y(point.api).toFixed(1)}`).join("");
  const last = known[known.length - 1];
  const forecasting = last !== undefined && ahead.length > 0;
  const cursor = Math.max(from, Math.min(to, at));
  // Every other midnight is named, so ten days of names do not collide.
  const midnights = malaysiaMidnights(from, to);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label={label}>
      <g fontSize="9.5" fill="var(--ink-tertiary)">
        <line x1={LEFT} x2={LEFT + 14} y1={8} y2={8} stroke="var(--ink)" strokeWidth="1.6" />
        <text x={LEFT + 18} y={11}>
          {legend.known}
        </text>
        {forecasting ? (
          <>
            <line x1={LEFT + 82} x2={LEFT + 96} y1={8} y2={8} stroke="var(--accent)" strokeWidth="1.6" strokeDasharray="4 3" />
            <text x={LEFT + 100} y={11}>
              {legend.ahead}
            </text>
          </>
        ) : null}
      </g>

      {[0, 100, 200, 300, 400].filter((value) => value <= top).map((value) => (
        <g key={value}>
          <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(value)} y2={y(value)} stroke="var(--hairline)" />
          <text x={LEFT - 5} y={y(value) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--ink-faint)">
            {value}
          </text>
        </g>
      ))}
      {GUIDES.map((guide) => (
        <g key={guide.value}>
          <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(guide.value)} y2={y(guide.value)} stroke="var(--ink-faint)" strokeDasharray="2 3" />
          {guide.note ? (
            <text x={WIDTH - RIGHT} y={y(guide.value) - 3} textAnchor="end" fontSize="9" fill="var(--ink-tertiary)">
              {guide.note}
            </text>
          ) : null}
        </g>
      ))}

      {midnights.map((midnight, index) => (
        <g key={midnight}>
          <line x1={x(midnight)} x2={x(midnight)} y1={HEIGHT - BOTTOM} y2={HEIGHT - BOTTOM + 3} stroke="var(--hairline-strong)" />
          {index % 2 === 0 && x(midnight) < WIDTH - RIGHT - LABEL_ROOM ? (
            <text x={x(midnight) + 2} y={HEIGHT - 5} fontSize="9.5" fill="var(--ink-tertiary)">
              {malaysiaDay(midnight)}
            </text>
          ) : null}
        </g>
      ))}

      {ranges.map((range) => (
        <rect key={range.at} x={x(range.at) - 3.5} width="7" y={y(range.high)} height={Math.max(2, y(range.low) - y(range.high))} rx="3.5" fill="var(--accent)" opacity="0.3" />
      ))}

      {forecasting ? (
        <g>
          <line x1={x(last.at)} x2={x(last.at)} y1={TOP - 4} y2={HEIGHT - BOTTOM} stroke="var(--accent)" strokeWidth="1" opacity="0.5" />
          {x(last.at) > LEGEND_END ? (
            <text x={x(last.at)} y={11} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="var(--accent)">
              Now
            </text>
          ) : null}
        </g>
      ) : null}
      <path d={path(known)} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
      {forecasting ? <path d={path([last, ...ahead])} fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeDasharray="4 3" strokeLinejoin="round" /> : null}
      <line x1={x(cursor)} x2={x(cursor)} y1={TOP - 4} y2={HEIGHT - BOTTOM} stroke="var(--ink-tertiary)" strokeWidth="1" />
    </svg>
  );
}
