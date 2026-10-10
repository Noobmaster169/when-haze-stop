"use client";

import { useState } from "react";

import type { Kind, ModelPerformance } from "@/lib/model-performance-schema";

import { ChartTip, KeyLegend } from "./chart-tip";
import { KIND_LABEL } from "./figures";
import { linear, niceAxis } from "./scale";

/**
 * Every scored station-day as one dot: across, how far the real next-day peak
 * moved from today's; up, how far the model said it would. One scale on both
 * axes, so the diagonal is a perfect forecast and a cloud flatter than it is
 * a model that under-calls the size of a change. Sensors are drawn first so
 * the fewer reference stations sit on top.
 */

const WIDTH = 640;
const LEFT = 44;
const RIGHT = 12;
const TOP = 14;
const BOTTOM = 40;
const STEP = 20;

export const KIND_COLOUR: Record<Kind, string> = {
  openaq: "var(--ink-tertiary)",
  nea: "var(--verdict-review)",
  doe: "var(--accent)",
};
const ORDER: Kind[] = ["openaq", "nea", "doe"];

export function ChangeScatter({ points }: { points: ModelPerformance["scatter"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const across = niceAxis([0, ...points.map((point) => point.real)], STEP);
  const up = niceAxis([0, ...points.map((point) => point.model)], STEP);
  const perUnit = (WIDTH - LEFT - RIGHT) / (across.high - across.low);
  const height = TOP + (up.high - up.low) * perUnit + BOTTOM;
  const x = linear(across.low, across.high, LEFT, WIDTH - RIGHT);
  const y = linear(up.low, up.high, height - BOTTOM, TOP);
  const from = Math.max(across.low, up.low);
  const to = Math.min(across.high, up.high);
  const drawn = ORDER.flatMap((kind) => points.map((point, index) => ({ point, index })).filter(({ point }) => point.kind === kind));
  const active = hover === null ? null : points[hover];

  return (
    <div className="relative">
      <KeyLegend
        items={ORDER.map((kind) => ({
          label: `${KIND_LABEL[kind]}s, ${points.filter((point) => point.kind === kind).length}`,
          colour: KIND_COLOUR[kind],
          shape: "dot" as const,
        }))}
      />
      <div className="mt-2 overflow-x-auto">
        <svg
          className="min-w-[520px]"
          viewBox={`0 0 ${WIDTH} ${height.toFixed(0)}`}
          width="100%"
          role="img"
          aria-label="Real next-day change against the model's forecast change, every station-day"
          onMouseLeave={() => setHover(null)}
        >
          {across.ticks.map((value) => (
            <g key={`x${value}`}>
              <line x1={x(value)} x2={x(value)} y1={TOP} y2={height - BOTTOM} stroke={value === 0 ? "var(--hairline-strong)" : "var(--hairline-faint)"} />
              <text x={x(value)} y={height - BOTTOM + 14} textAnchor="middle" fontSize="10" fill="var(--ink-tertiary)">
                {value}
              </text>
            </g>
          ))}
          {up.ticks.map((value) => (
            <g key={`y${value}`}>
              <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(value)} y2={y(value)} stroke={value === 0 ? "var(--hairline-strong)" : "var(--hairline-faint)"} />
              <text x={LEFT - 6} y={y(value) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-tertiary)">
                {value}
              </text>
            </g>
          ))}
          <line x1={x(from)} y1={y(from)} x2={x(to)} y2={y(to)} stroke="var(--ink-secondary)" strokeDasharray="4 3" />
          <text x={x(to) - 10} y={y(to) + 4} textAnchor="end" fontSize="10" fill="var(--ink-secondary)">
            perfect forecast
          </text>
          {drawn.map(({ point, index }) => (
            <circle
              key={index}
              cx={x(point.real).toFixed(1)}
              cy={y(point.model).toFixed(1)}
              r={hover === index ? 4.5 : 2.6}
              fill={KIND_COLOUR[point.kind]}
              fillOpacity={hover === index ? 1 : point.kind === "openaq" ? 0.3 : 0.55}
              onMouseEnter={() => setHover(index)}
            />
          ))}
          <text x={(LEFT + WIDTH - RIGHT) / 2} y={height - 6} textAnchor="middle" fontSize="10.5" fill="var(--ink-secondary)">
            Real change in the next-day peak, µg/m³
          </text>
          <text x={LEFT + 4} y={TOP + 10} fontSize="10.5" fill="var(--ink-secondary)">
            Forecast change, µg/m³
          </text>
        </svg>
      </div>
      {active && hover !== null ? (
        <ChartTip left={active.real > 0}>
          <div className="font-medium text-ink">{KIND_LABEL[active.kind]}</div>
          <div>Real change {active.real.toFixed(1)} µg/m³</div>
          <div>Forecast change {active.model.toFixed(1)} µg/m³</div>
        </ChartTip>
      ) : null}
    </div>
  );
}
