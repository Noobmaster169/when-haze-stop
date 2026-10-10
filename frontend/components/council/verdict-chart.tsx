"use client";

import { useEffect, useRef, useState } from "react";

import type { Verdict } from "@/lib/api/council-schemas";
import { malaysiaDay, malaysiaMidnights, malaysiaWhen } from "@/lib/malaysia-time";

import { API_100_PM25 } from "./pm25";

/**
 * KL's 24-hour PM2.5, hour by hour from the data's hour, without the plan and
 * with it, with the API 100 line. The band between the two lines is the smoke
 * the plan removes. Hover reads both values at an hour.
 */

const HEIGHT = 230;
const PAD = { left: 34, right: 92, top: 12, bottom: 26 };
const HOUR = 3_600_000;

export function VerdictChart({ verdict, asOf }: { verdict: Verdict; asOf: string | null }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(300, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { baseline, withPlan } = verdict.series;
  const hours = Math.min(baseline.length, withPlan.length);
  if (hours < 2) return <p className="text-small text-ink-tertiary">The engine returned no hourly series for this plan.</p>;

  const start = asOf ? Date.parse(asOf) : null;
  const top = Math.max(API_100_PM25 * 1.15, ...baseline.slice(0, hours), ...withPlan.slice(0, hours)) * 1.05;
  const step = top > 120 ? 50 : top > 60 ? 20 : 10;
  const x = (hour: number) => PAD.left + (hour / (hours - 1)) * (width - PAD.left - PAD.right);
  const y = (value: number) => PAD.top + (1 - value / top) * (HEIGHT - PAD.top - PAD.bottom);
  const line = (values: number[]) => values.slice(0, hours).map((value, hour) => `${hour === 0 ? "M" : "L"}${x(hour).toFixed(1)},${y(value).toFixed(1)}`).join("");
  const band = `${line(baseline)}${withPlan
    .slice(0, hours)
    .map((value, hour) => [hour, value] as const)
    .reverse()
    .map(([hour, value]) => `L${x(hour).toFixed(1)},${y(value).toFixed(1)}`)
    .join("")}Z`;
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, index) => index * step);
  // A day name needs about 46 px; on a narrow chart every second or third day is named.
  const labelEvery = Math.max(1, Math.ceil(46 / ((24 * (width - PAD.left - PAD.right)) / Math.max(1, hours - 1))));
  const days = start ? malaysiaMidnights(start, start + (hours - 1) * HOUR).map((at) => ({ at, hour: (at - start) / HOUR })) : [];
  const last = hours - 1;
  // The two end labels sit on their lines, pushed apart when the lines end close together.
  const above = baseline[last] >= withPlan[last];
  const middle = (y(baseline[last]) + y(withPlan[last])) / 2;
  const gap = Math.max(13, Math.abs(y(baseline[last]) - y(withPlan[last])));
  const ends = { without: middle + (above ? -gap / 2 : gap / 2) + 3.5, with: middle + (above ? gap / 2 : -gap / 2) + 3.5 };

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const hour = Math.round(((event.clientX - bounds.left - PAD.left) / (width - PAD.left - PAD.right)) * (hours - 1));
    setHover(Math.max(0, Math.min(last, hour)));
  };

  return (
    <figure>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-small font-medium text-ink">KL&apos;s 24-hour PM2.5, ug/m3</span>
        <span className="flex gap-4 text-caption text-ink-secondary">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-ink-tertiary" />
            Without the plan
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-accent" />
            With the plan
          </span>
        </span>
      </figcaption>
      <div ref={box} className="relative mt-2">
        <svg width={width} height={HEIGHT} role="img" aria-label="KL's 24-hour PM2.5 without and with the plan" onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="block touch-none">
          {ticks.map((value) => (
            <g key={value}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(value)} y2={y(value)} stroke="var(--hairline-faint)" />
              <text x={PAD.left - 6} y={y(value) + 3.5} textAnchor="end" fontSize="10.5" fill="var(--ink-tertiary)">
                {value}
              </text>
            </g>
          ))}
          {days.map((day, index) => (
            <g key={day.at}>
              <line x1={x(day.hour)} x2={x(day.hour)} y1={HEIGHT - PAD.bottom} y2={HEIGHT - PAD.bottom + 4} stroke="var(--hairline-strong)" />
              {index % labelEvery === 0 ? (
                <text x={x(day.hour) + 3} y={HEIGHT - 8} fontSize="10.5" fill="var(--ink-tertiary)">
                  {malaysiaDay(day.at)}
                </text>
              ) : null}
            </g>
          ))}
          <line x1={PAD.left} x2={width - PAD.right} y1={y(API_100_PM25)} y2={y(API_100_PM25)} stroke="var(--api-150)" strokeDasharray="4 4" strokeWidth={1.25} />
          <text x={PAD.left + 4} y={y(API_100_PM25) - 4} fontSize="10.5" fill="var(--ink-secondary)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke">
            API 100
          </text>
          <path d={band} fill="var(--accent)" opacity={0.14} />
          <path d={line(baseline)} fill="none" stroke="var(--ink-tertiary)" strokeWidth={2} strokeLinejoin="round" />
          <path d={line(withPlan)} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
          <text x={x(last) + 6} y={ends.without} fontSize="10.5" fill="var(--ink-secondary)">
            Without
          </text>
          <text x={x(last) + 6} y={ends.with} fontSize="10.5" fill="var(--ink-secondary)">
            With
          </text>
          {hover !== null ? (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="var(--hairline-strong)" />
              <circle cx={x(hover)} cy={y(baseline[hover])} r={4} fill="var(--ink-tertiary)" stroke="var(--surface)" strokeWidth={2} />
              <circle cx={x(hover)} cy={y(withPlan[hover])} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          ) : null}
        </svg>
        {hover !== null ? (
          <div
            className="pointer-events-none absolute top-1 rounded-md border border-hairline bg-canvas px-2.5 py-1.5 text-caption shadow-overlay"
            style={{ left: Math.min(x(hover) + 10, width - 180) }}
          >
            <div className="text-ink-tertiary">{start ? `${malaysiaWhen(start + hover * HOUR)} MYT` : `Hour ${hover}`}</div>
            <div className="text-ink tabular-nums">Without {baseline[hover].toFixed(1)}</div>
            <div className="text-ink tabular-nums">With {withPlan[hover].toFixed(1)}</div>
            <div className="text-ink-secondary tabular-nums">Removed {(baseline[hover] - withPlan[hover]).toFixed(2)}</div>
          </div>
        ) : null}
      </div>
    </figure>
  );
}
