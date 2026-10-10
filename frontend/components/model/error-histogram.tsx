"use client";

import { useState } from "react";

import type { HistogramBin } from "@/lib/model-performance-schema";

import { ChartTip, KeyLegend } from "./chart-tip";
import { linear, niceAxis } from "./scale";

/**
 * Station-days counted by how far the next-day peak missed, in bins of
 * 5 µg/m³, the model's bar beside no change's. The last bin is open ended.
 * Hover a bin for both counts.
 */

const WIDTH = 640;
const HEIGHT = 220;
const LEFT = 44;
const RIGHT = 8;
const TOP = 22;
const BOTTOM = 34;

const range = (bins: readonly HistogramBin[], index: number): string => (index === bins.length - 1 ? `${bins[index].low} µg/m³ or more` : `${bins[index].low} to ${bins[index + 1].low} µg/m³`);

export function ErrorHistogram({ bins, label }: { bins: readonly HistogramBin[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const axis = niceAxis([0, ...bins.flatMap((bin) => [bin.model, bin.noChange])], 200);
  const y = linear(axis.low, axis.high, HEIGHT - BOTTOM, TOP);
  const slot = (WIDTH - LEFT - RIGHT) / bins.length;
  const bar = slot * 0.36;
  const active = hover === null ? null : bins[hover];

  return (
    <div className="relative">
      <KeyLegend
        items={[
          { label: "Model", colour: "var(--series-model)" },
          { label: "No change", colour: "var(--series-same)" },
        ]}
      />
      <div className="mt-2 overflow-x-auto">
        <svg className="min-w-[520px]" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
          {axis.ticks.map((value) => (
            <g key={value}>
              <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(value)} y2={y(value)} stroke={value === 0 ? "var(--hairline-strong)" : "var(--hairline-faint)"} />
              <text x={LEFT - 6} y={y(value) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-tertiary)">
                {value}
              </text>
            </g>
          ))}
          {bins.map((bin, index) => {
            const x = LEFT + slot * index;
            const dim = hover !== null && hover !== index;
            return (
              <g key={bin.low} opacity={dim ? 0.45 : 1}>
                <rect x={x + slot / 2 - bar - 1} y={y(bin.model)} width={bar} height={y(0) - y(bin.model)} fill="var(--series-model)" rx="1.5" />
                <rect x={x + slot / 2 + 1} y={y(bin.noChange)} width={bar} height={y(0) - y(bin.noChange)} fill="var(--series-same)" rx="1.5" />
                <text x={x} y={HEIGHT - BOTTOM + 14} textAnchor="middle" fontSize="10" fill="var(--ink-tertiary)">
                  {bin.low}
                </text>
                <rect x={x} y={TOP} width={slot} height={HEIGHT - TOP - BOTTOM} fill="transparent" onMouseEnter={() => setHover(index)} />
              </g>
            );
          })}
          <text x={(LEFT + WIDTH - RIGHT) / 2} y={HEIGHT - 4} textAnchor="middle" fontSize="10.5" fill="var(--ink-secondary)">
            Absolute error of the next-day peak, µg/m³ (last bar: 60 or more)
          </text>
          <text x={LEFT - 6} y={10} textAnchor="end" fontSize="10.5" fill="var(--ink-secondary)">
            Days
          </text>
        </svg>
      </div>
      {active && hover !== null ? (
        <ChartTip left={hover >= bins.length / 2}>
          <div className="font-medium text-ink">Missed by {range(bins, hover)}</div>
          <div>Model {active.model} station-days</div>
          <div>No change {active.noChange} station-days</div>
        </ChartTip>
      ) : null}
    </div>
  );
}
