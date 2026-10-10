"use client";

import { useState } from "react";

import type { StationSeries } from "@/lib/model-performance-schema";

import { dayLabel, linear, niceAxis } from "./scale";

/**
 * One station's next-day peak, day by day: what was read, the model with its
 * 10 to 90 band, and "no change" (tomorrow equals today). Days sit evenly on
 * the x axis, µg/m³ on the y axis from a round floor. DOE's API 150 line is
 * drawn where it falls (55.4 µg/m³). Hover a day for its four numbers; the
 * tooltip sits on the side away from the pointer.
 */

const WIDTH = 640;
const HEIGHT = 240;
const LEFT = 40;
const RIGHT = 12;
const TOP = 12;
const BOTTOM = 26;
const API_150 = 55.4;
const MAX_LABELS = 8;

export function StationChart({ series }: { series: StationSeries }) {
  const [hover, setHover] = useState<number | null>(null);
  const rows = series.rows;
  const axis = niceAxis(
    rows.flatMap((row) => [row.real, row.low, row.high, row.noChange]),
    25,
  );
  const slot = (WIDTH - LEFT - RIGHT) / rows.length;
  const x = (index: number): number => LEFT + slot * (index + 0.5);
  const y = linear(axis.low, axis.high, HEIGHT - BOTTOM, TOP);
  const line = (pick: (index: number) => number): string => rows.map((_, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(pick(index)).toFixed(1)}`).join("");
  const band = `${line((index) => rows[index].high)}${rows
    .map((_, index) => rows.length - 1 - index)
    .map((index) => `L${x(index).toFixed(1)},${y(rows[index].low).toFixed(1)}`)
    .join("")}Z`;
  const every = Math.ceil(rows.length / MAX_LABELS);
  const active = hover === null ? null : rows[hover];
  const dots = rows.length <= 10;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label={`${series.name}: real next-day peak, the model with its band, and no change`} onMouseLeave={() => setHover(null)}>
        {axis.ticks.map((value) => (
          <g key={value}>
            <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(value)} y2={y(value)} stroke={value === axis.low ? "var(--hairline-strong)" : "var(--hairline-faint)"} />
            <text x={LEFT - 6} y={y(value) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-faint)">
              {value}
            </text>
          </g>
        ))}
        {API_150 > axis.low && API_150 < axis.high ? (
          <g>
            <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(API_150)} y2={y(API_150)} stroke="var(--ink-faint)" strokeDasharray="1 3" />
            <text x={WIDTH - RIGHT} y={y(API_150) - 4} textAnchor="end" fontSize="10" fill="var(--ink-tertiary)">
              API 150
            </text>
          </g>
        ) : null}
        <path d={band} fill="var(--series-model)" opacity="0.16" />
        <path d={line((index) => rows[index].noChange)} fill="none" stroke="var(--series-same)" strokeWidth="1.6" strokeDasharray="4 3" strokeLinejoin="round" />
        <path d={line((index) => rows[index].model)} fill="none" stroke="var(--series-model)" strokeWidth="2" strokeLinejoin="round" />
        <path d={line((index) => rows[index].real)} fill="none" stroke="var(--series-real)" strokeWidth="2" strokeLinejoin="round" />
        {rows.map((row, index) => (
          <g key={row.day}>
            {index % every === 0 ? (
              <text x={x(index)} y={HEIGHT - 8} textAnchor="middle" fontSize="10" fill="var(--ink-tertiary)">
                {dayLabel(row.day)}
              </text>
            ) : null}
            {dots || hover === index ? (
              <>
                <circle cx={x(index)} cy={y(row.model)} r="3" fill="var(--series-model)" />
                <circle cx={x(index)} cy={y(row.real)} r="3" fill="var(--series-real)" />
              </>
            ) : null}
            <rect x={x(index) - slot / 2} y={TOP} width={slot} height={HEIGHT - TOP - BOTTOM} fill="transparent" onMouseEnter={() => setHover(index)} />
          </g>
        ))}
        {hover === null ? null : <line x1={x(hover)} x2={x(hover)} y1={TOP} y2={HEIGHT - BOTTOM} stroke="var(--hairline-strong)" pointerEvents="none" />}
      </svg>
      {active ? (
        <div className={`pointer-events-none absolute top-1 ${hover !== null && hover >= rows.length / 2 ? "left-12" : "right-2"} rounded-md border border-hairline bg-surface px-3 py-2 text-small shadow-[var(--shadow-overlay)]`}>
          <div className="font-medium text-ink">{dayLabel(active.day)}</div>
          <div className="text-ink-secondary">Real peak {active.real.toFixed(1)} µg/m³</div>
          <div className="text-ink-secondary">
            Model {active.model.toFixed(1)}, band {active.low.toFixed(1)} to {active.high.toFixed(1)}
          </div>
          <div className="text-ink-secondary">No change {active.noChange.toFixed(1)}</div>
        </div>
      ) : null}
    </div>
  );
}
