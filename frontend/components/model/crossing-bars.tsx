"use client";

import { useState } from "react";

import type { CrossTally, ModelPerformance } from "@/lib/model-performance-schema";

import { ChartTip, KeyLegend } from "./chart-tip";
import { linear, niceAxis } from "./scale";

/**
 * Next-day crossings of API 150, one stacked bar per forecast: caught, missed,
 * then false alarms. Caught plus missed is the same for every forecast (the
 * real crossings), so the dotted line marks it and the false alarms run past
 * it. Hover a segment for its count and share.
 */

const WIDTH = 640;
const LEFT = 150;
const RIGHT = 16;
const TOP = 22;
const ROW = 28;
const GAP = 14;
const BOTTOM = 24;

type Part = "caught" | "missed" | "falseAlarm";

const PARTS: { key: Part; label: string; colour: string }[] = [
  { key: "caught", label: "Caught", colour: "var(--verdict-match)" },
  { key: "missed", label: "Missed", colour: "var(--verdict-fault)" },
  { key: "falseAlarm", label: "False alarm", colour: "var(--verdict-differ)" },
];

const FORECASTS: { key: keyof ModelPerformance["cross150"]; label: string; note: string }[] = [
  { key: "model", label: "Model", note: "learned, 600 trees" },
  { key: "noChange", label: "No change", note: "tomorrow = today" },
  { key: "v2", label: "Hourly forecast", note: "the app's old one" },
];

function describe(tally: CrossTally, part: Part): string {
  const events = tally.caught + tally.missed;
  const called = tally.caught + tally.falseAlarm;
  if (part === "falseAlarm") return `${tally.falseAlarm} of ${called} called crossings did not happen`;
  return `${tally[part]} of ${events} real crossings`;
}

export function CrossingBars({ tallies }: { tallies: ModelPerformance["cross150"] }) {
  const [hover, setHover] = useState<{ row: number; part: Part } | null>(null);
  const totals = FORECASTS.map((forecast) => tallies[forecast.key].caught + tallies[forecast.key].missed + tallies[forecast.key].falseAlarm);
  const axis = niceAxis([0, ...totals], 100);
  const x = linear(0, axis.high, LEFT, WIDTH - RIGHT);
  const height = TOP + FORECASTS.length * (ROW + GAP) - GAP + BOTTOM;
  const events = tallies.model.caught + tallies.model.missed;
  const active =
    hover === null
      ? null
      : {
          forecast: FORECASTS[hover.row],
          part: PARTS.find((part) => part.key === hover.part),
        };

  return (
    <div className="relative">
      <KeyLegend items={PARTS} />
      <div className="mt-2 overflow-x-auto">
        <svg
          className="min-w-[520px]"
          viewBox={`0 0 ${WIDTH} ${height}`}
          width="100%"
          role="img"
          aria-label="Crossings of API 150 caught, missed and falsely called by each forecast"
          onMouseLeave={() => setHover(null)}
        >
          {axis.ticks.map((value) => (
            <g key={value}>
              <line x1={x(value)} x2={x(value)} y1={TOP} y2={height - BOTTOM} stroke={value === 0 ? "var(--hairline-strong)" : "var(--hairline-faint)"} />
              <text x={x(value)} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--ink-tertiary)">
                {value}
              </text>
            </g>
          ))}
          {FORECASTS.map((forecast, row) => {
            const tally = tallies[forecast.key];
            const top = TOP + row * (ROW + GAP);
            let start = 0;
            return (
              <g key={forecast.key}>
                <text x={LEFT - 10} y={top + ROW / 2 - 2} textAnchor="end" fontSize="11.5" fill="var(--ink)">
                  {forecast.label}
                </text>
                <text x={LEFT - 10} y={top + ROW / 2 + 11} textAnchor="end" fontSize="10" fill="var(--ink-tertiary)">
                  {forecast.note}
                </text>
                {PARTS.map((part) => {
                  const from = start;
                  start += tally[part.key];
                  const dim = hover !== null && !(hover.row === row && hover.part === part.key);
                  return (
                    <g key={part.key} opacity={dim ? 0.55 : 1} onMouseEnter={() => setHover({ row, part: part.key })}>
                      <rect x={x(from)} y={top} width={x(start) - x(from)} height={ROW} fill={part.colour} stroke="var(--canvas)" strokeWidth="1" />
                      <text x={(x(from) + x(start)) / 2} y={top + ROW / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="500" fill="var(--ink-inverse)">
                        {tally[part.key]}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
          <line x1={x(events)} x2={x(events)} y1={TOP - 6} y2={height - BOTTOM} stroke="var(--ink-tertiary)" strokeDasharray="2 3" pointerEvents="none" />
          <text x={x(events)} y={TOP - 9} textAnchor="middle" fontSize="10" fill="var(--ink-secondary)">
            {events} real crossings
          </text>
        </svg>
      </div>
      {active && active.part && hover ? (
        <ChartTip left={hover.part !== "caught"}>
          <div className="font-medium text-ink">
            {active.forecast.label}: {active.part.label.toLowerCase()}
          </div>
          <div>{describe(tallies[active.forecast.key], hover.part)}</div>
        </ChartTip>
      ) : null}
    </div>
  );
}
