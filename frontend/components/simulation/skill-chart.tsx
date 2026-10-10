"use client";

import { useState } from "react";

import type { LeadSkill } from "@/lib/api/simulation-schemas";

/**
 * The proof in one picture: how much closer the forecast came than "no
 * change", hours ahead by hours ahead, on exactly the same replayed cases.
 * Each bar carries the 90% interval from resampling whole days; a bar whose
 * interval clears zero is a difference the week cannot explain away. Hover a
 * bar for the misses behind it.
 */

const WIDTH = 640;
const HEIGHT = 230;
const LEFT = 44;
const RIGHT = 12;
const TOP = 22;
const BOTTOM = 30;

/** Percent closer than no change: above zero the forecast missed by less. */
function closer(row: LeadSkill, difference: number): number {
  return row.persistence === 0 ? 0 : (-100 * difference) / row.persistence;
}

export function SkillChart({ rows }: { rows: LeadSkill[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = rows.filter((row) => row.cases > 0);
  if (shown.length === 0) return null;

  const values = shown.flatMap((row) => [closer(row, row.low), closer(row, row.high), closer(row, row.model - row.persistence)]);
  const top = Math.max(10, Math.ceil(Math.max(...values) / 10) * 10);
  const bottom = Math.min(-10, Math.floor(Math.min(...values) / 10) * 10);
  const slot = (WIDTH - LEFT - RIGHT) / shown.length;
  const y = (value: number): number => TOP + ((top - value) / (top - bottom)) * (HEIGHT - TOP - BOTTOM);
  const ticks = Array.from({ length: (top - bottom) / 10 + 1 }, (_, index) => bottom + index * 10);
  const active = hover === null ? null : shown.find((row) => row.lead === hover) ?? null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label="Percent closer than assuming no change, by hours ahead" onMouseLeave={() => setHover(null)}>
        {ticks.map((value) => (
          <g key={value}>
            <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(value)} y2={y(value)} stroke={value === 0 ? "var(--hairline-strong)" : "var(--hairline-faint)"} />
            <text x={LEFT - 6} y={y(value) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-faint)">
              {value > 0 ? `+${value}%` : `${value}%`}
            </text>
          </g>
        ))}
        {shown.map((row, index) => {
          const value = closer(row, row.model - row.persistence);
          const centre = LEFT + slot * (index + 0.5);
          const barTop = y(Math.max(0, value));
          const barHeight = Math.max(1, Math.abs(y(value) - y(0)));
          const clear = closer(row, row.high) > 0 || closer(row, row.low) < 0;
          return (
            <g key={row.lead}>
              <rect x={centre - slot * 0.28} y={barTop} width={slot * 0.56} height={barHeight} rx="3" fill={value >= 0 ? "var(--accent)" : "var(--ink-faint)"} opacity={clear ? 1 : 0.45} />
              <line x1={centre} x2={centre} y1={y(closer(row, row.low))} y2={y(closer(row, row.high))} stroke="var(--ink-secondary)" strokeWidth="1.5" />
              <text x={centre + slot * 0.3} y={value >= 0 ? barTop + 12 : y(value) - 4} textAnchor="start" fontSize="11" fill="var(--ink)">
                {value >= 0 ? `+${Math.round(value)}%` : `${Math.round(value)}%`}
              </text>
              <text x={centre} y={HEIGHT - BOTTOM + 16} textAnchor="middle" fontSize="10.5" fill="var(--ink-tertiary)">
                {row.lead}h
              </text>
              <rect x={centre - slot / 2} y={TOP} width={slot} height={HEIGHT - TOP - BOTTOM} fill="transparent" onMouseEnter={() => setHover(row.lead)} />
            </g>
          );
        })}
      </svg>
      {active ? (
        <div className="pointer-events-none absolute top-1 right-2 rounded-md border border-hairline bg-surface px-3 py-2 text-small shadow-[var(--shadow-overlay)]">
          <div className="font-medium text-ink">{active.lead} hours ahead</div>
          <div className="text-ink-secondary">
            Average miss {active.model.toFixed(2)} against {active.persistence.toFixed(2)} for no change
          </div>
          <div className="text-ink-tertiary">
            90% interval {Math.round(closer(active, active.high))}% to {Math.round(closer(active, active.low))}% closer
          </div>
          <div className="text-ink-tertiary">{active.cases.toLocaleString("en-GB")} forecasts checked</div>
        </div>
      ) : null}
    </div>
  );
}
