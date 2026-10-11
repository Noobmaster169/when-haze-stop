"use client";

import { useState } from "react";

import type { Station } from "@/lib/model-performance-schema";

import { ChartTip } from "./chart-tip";
import { dayLabel, linear } from "./scale";
import { percent } from "./table";

/**
 * One instrument as a small multiple: the real next-day peak, the model with
 * its 10 to 90 band, and no change, on a y scale from 0 to `top` that every
 * panel of its set shares. The dotted line is API 150 (55.4 µg/m³). Hover a
 * day for its numbers.
 */

const HEIGHT = 124;
const LEFT = 26;
const RIGHT = 6;
const TOP = 6;
const BOTTOM = 16;
const API_150 = 55.4;
const STEP = 50;

/** `width` is the drawing's own width in user units: a narrower drawing in a narrower cell keeps the 9-unit labels near 9 pixels. */
export function StationPanel({ station, top, width = 300 }: { station: Station; top: number; width?: number }) {
  const WIDTH = width;
  const [hover, setHover] = useState<number | null>(null);
  const rows = station.rows;
  const slot = (WIDTH - LEFT - RIGHT) / rows.length;
  const x = (index: number): number => LEFT + slot * (index + 0.5);
  const y = linear(0, top, HEIGHT - BOTTOM, TOP);
  const ticks = Array.from({ length: top / STEP + 1 }, (_, index) => index * STEP);
  const line = (pick: (index: number) => number): string => rows.map((_, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(pick(index)).toFixed(1)}`).join("");
  const band = `${line((index) => rows[index].high)}${rows
    .map((_, index) => rows.length - 1 - index)
    .map((index) => `L${x(index).toFixed(1)},${y(rows[index].low).toFixed(1)}`)
    .join("")}Z`;
  const dots = rows.length <= 10;
  const active = hover === null ? null : rows[hover];

  return (
    <figure className="relative min-w-0 rounded-md border border-hairline-faint bg-surface px-2 pt-1.5 pb-1">
      <figcaption className="flex items-baseline justify-between gap-2 px-1">
        <span className="truncate text-small text-ink" title={station.name}>
          {station.name}
        </span>
        <span className="shrink-0 font-mono text-mono-xs text-ink-secondary">{percent(station.score.within20)} within 20</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        role="img"
        aria-label={`${station.name}: real next-day peak, the model with its band, and no change, ${rows.length} days`}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((value) => (
          <g key={value}>
            <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(value)} y2={y(value)} stroke={value === 0 ? "var(--hairline-strong)" : "var(--hairline-faint)"} />
            <text x={LEFT - 4} y={y(value) + 3} textAnchor="end" fontSize="9" fill="var(--ink-tertiary)">
              {value}
            </text>
          </g>
        ))}
        <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(API_150)} y2={y(API_150)} stroke="var(--ink-tertiary)" strokeDasharray="1 3" />
        <path d={band} fill="var(--series-model)" opacity="0.16" />
        <path d={line((index) => rows[index].noChange)} fill="none" stroke="var(--series-same)" strokeWidth="1.3" strokeDasharray="3 2" strokeLinejoin="round" />
        <path d={line((index) => rows[index].model)} fill="none" stroke="var(--series-model)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d={line((index) => rows[index].real)} fill="none" stroke="var(--series-real)" strokeWidth="1.6" strokeLinejoin="round" />
        {rows.map((row, index) => (
          <g key={row.day}>
            {dots || hover === index ? (
              <>
                <circle cx={x(index)} cy={y(row.model)} r="2.2" fill="var(--series-model)" />
                <circle cx={x(index)} cy={y(row.real)} r="2.2" fill="var(--series-real)" />
              </>
            ) : null}
            <rect x={x(index) - slot / 2} y={TOP} width={slot} height={HEIGHT - TOP - BOTTOM} fill="transparent" onMouseEnter={() => setHover(index)} />
          </g>
        ))}
        {hover === null ? null : <line x1={x(hover)} x2={x(hover)} y1={TOP} y2={HEIGHT - BOTTOM} stroke="var(--hairline-strong)" pointerEvents="none" />}
        <text x={LEFT} y={HEIGHT - 3} fontSize="9" fill="var(--ink-tertiary)">
          {dayLabel(rows[0].day)}
        </text>
        <text x={WIDTH - RIGHT} y={HEIGHT - 3} textAnchor="end" fontSize="9" fill="var(--ink-tertiary)">
          {dayLabel(rows[rows.length - 1].day)}
        </text>
      </svg>
      {active && hover !== null ? (
        <ChartTip left={hover >= rows.length / 2}>
          <div className="font-medium text-ink">{dayLabel(active.day)}</div>
          <div>Real {active.real.toFixed(1)}</div>
          <div>
            Model {active.model.toFixed(1)} ({active.low.toFixed(1)} to {active.high.toFixed(1)})
          </div>
          <div>No change {active.noChange.toFixed(1)}</div>
        </ChartTip>
      ) : null}
    </figure>
  );
}
