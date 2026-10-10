import type { ModelPerformance } from "@/lib/model-performance-schema";

import { linear, niceAxis } from "./scale";

/**
 * Every scored station-day as one dot: across, how far the real next-day peak
 * moved from today's; up, how far the model said it would. Both axes share one
 * scale in µg/m³, so the diagonal is a perfect forecast and a cloud flatter
 * than it is a model that under-calls the size of a change.
 */

const WIDTH = 640;
const LEFT = 44;
const RIGHT = 12;
const TOP = 14;
const BOTTOM = 40;
const STEP = 20;

export function ChangeScatter({ points }: { points: ModelPerformance["scatter"] }) {
  const across = niceAxis(
    points.map((point) => point.real),
    STEP,
  );
  const up = niceAxis(
    points.map((point) => point.model),
    STEP,
  );
  const perUnit = (WIDTH - LEFT - RIGHT) / (across.high - across.low);
  const height = TOP + (up.high - up.low) * perUnit + BOTTOM;
  const x = linear(across.low, across.high, LEFT, WIDTH - RIGHT);
  const y = linear(up.low, up.high, height - BOTTOM, TOP);
  const from = Math.max(across.low, up.low);
  const to = Math.min(across.high, up.high);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height.toFixed(0)}`} width="100%" role="img" aria-label="Real next-day change against the model's forecast change, every station-day">
      {across.ticks.map((value) => (
        <g key={`x${value}`}>
          <line x1={x(value)} x2={x(value)} y1={TOP} y2={height - BOTTOM} stroke={value === 0 ? "var(--hairline-strong)" : "var(--hairline-faint)"} />
          <text x={x(value)} y={height - BOTTOM + 14} textAnchor="middle" fontSize="10" fill="var(--ink-faint)">
            {value}
          </text>
        </g>
      ))}
      {up.ticks.map((value) => (
        <g key={`y${value}`}>
          <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(value)} y2={y(value)} stroke={value === 0 ? "var(--hairline-strong)" : "var(--hairline-faint)"} />
          <text x={LEFT - 6} y={y(value) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-faint)">
            {value}
          </text>
        </g>
      ))}
      <line x1={x(from)} y1={y(from)} x2={x(to)} y2={y(to)} stroke="var(--ink-tertiary)" strokeDasharray="4 3" />
      <text x={x(to) - 4} y={y(to) + 12} textAnchor="end" fontSize="10" fill="var(--ink-tertiary)">
        perfect forecast
      </text>
      {points.map((point, index) => (
        <circle key={index} cx={x(point.real).toFixed(1)} cy={y(point.model).toFixed(1)} r="2.6" fill="var(--series-model)" fillOpacity="0.4">
          <title>{`Real change ${point.real.toFixed(1)}, forecast change ${point.model.toFixed(1)} µg/m³`}</title>
        </circle>
      ))}
      <text x={(LEFT + WIDTH - RIGHT) / 2} y={height - 6} textAnchor="middle" fontSize="10.5" fill="var(--ink-secondary)">
        Real change in the next-day peak, µg/m³
      </text>
      <text x={LEFT + 4} y={TOP + 10} fontSize="10.5" fill="var(--ink-secondary)">
        Forecast change, µg/m³
      </text>
    </svg>
  );
}
