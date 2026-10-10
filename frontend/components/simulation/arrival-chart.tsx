import type { Arrival } from "@/lib/api/simulation-schemas";
import { formatWhenShort } from "@/lib/when";

/**
 * One station as haze arrived: the day before in ink, the forecast made at
 * the hour it crossed 100 in amber, "no change" dotted, and what then
 * happened. The backend picks the cases by rule, so losses show too.
 */

const WIDTH = 300;
const HEIGHT = 150;
const LEFT = 28;
const RIGHT = 8;
const TOP = 10;
const BOTTOM = 18;

export function ArrivalChart({ arrival }: { arrival: Arrival }) {
  const made = Date.parse(arrival.madeAt);
  const points = arrival.readings.map((point) => ({ at: Date.parse(point.at), api: point.api }));
  const ahead = arrival.forecast.map((point) => ({ at: Date.parse(point.at), api: point.api }));
  const from = points[0].at;
  const to = Math.max(points[points.length - 1].at, ahead[ahead.length - 1]?.at ?? 0);
  const values = [...points, ...ahead].map((point) => point.api);
  const low = Math.max(0, Math.floor((Math.min(...values) - 10) / 50) * 50);
  const high = Math.ceil((Math.max(...values) + 10) / 50) * 50;
  const x = (at: number): number => LEFT + ((at - from) / (to - from)) * (WIDTH - LEFT - RIGHT);
  const y = (api: number): number => TOP + (1 - (api - low) / (high - low)) * (HEIGHT - TOP - BOTTOM);
  const path = (list: { at: number; api: number }[]): string => list.map((point, index) => `${index === 0 ? "M" : "L"}${x(point.at).toFixed(1)},${y(point.api).toFixed(1)}`).join("");
  const startValue = points.find((point) => point.at === made)?.api ?? ahead[0]?.api ?? 0;
  const won = arrival.model < arrival.persistence;
  const ticks = Array.from({ length: (high - low) / 50 + 1 }, (_, index) => low + index * 50);

  return (
    <figure className="rounded-lg border border-hairline bg-surface p-3">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-small font-medium text-ink">{arrival.stationName}</span>
        <span className="text-caption text-ink-tertiary">{formatWhenShort(arrival.madeAt)} UTC</span>
      </figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label={`${arrival.stationName}: readings and the forecast made as haze arrived`} className="mt-1">
        {ticks.map((value) => (
          <g key={value}>
            <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(value)} y2={y(value)} stroke="var(--hairline-faint)" />
            <text x={LEFT - 5} y={y(value) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--ink-faint)">
              {value}
            </text>
          </g>
        ))}
        <line x1={x(made)} x2={x(made)} y1={TOP} y2={HEIGHT - BOTTOM} stroke="var(--hairline-strong)" />
        <text x={x(made) + 3} y={HEIGHT - 5} fontSize="9.5" fill="var(--ink-tertiary)">
          forecast made
        </text>
        <line x1={x(made)} x2={x(to)} y1={y(startValue)} y2={y(startValue)} stroke="var(--ink-tertiary)" strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" />
        <path d={path(points)} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d={path([{ at: made, api: startValue }, ...ahead])} fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="5 3" strokeLinejoin="round" />
      </svg>
      <p className="mt-1 text-caption text-ink-secondary">
        Next 24 h, average miss: <span className={won ? "font-medium text-ink" : ""}>forecast {arrival.model.toFixed(1)}</span>,{" "}
        <span className={won ? "" : "font-medium text-ink"}>no change {arrival.persistence.toFixed(1)}</span>
      </p>
    </figure>
  );
}
