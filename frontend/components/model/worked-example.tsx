import type { ReactNode } from "react";

import { pm25ToApi } from "@/components/map/scale";
import type { ModelPerformance } from "@/lib/model-performance-schema";

import { Code } from "./prose";

/**
 * One real row run through the function, as input, process and output. The
 * figures come from the published file; the three the file does not carry
 * (the neighbouring sector, next-day wind and rain, smoke at +24 h) were
 * read from the same live artifact on 11 October 2026 and are named here.
 */

const NEIGHBOUR_SECTOR_MW = 25_000;
const WIND_MS = 3;
const RAIN_24H_MM = 0.8;
const SMOKE_24H = 145;

const thousands = (value: number): string => `${(Math.round(value / 1000) * 1000).toLocaleString("en-GB")}`;
const api = (ugm3: number): number => Math.round(pm25ToApi(ugm3));

function longDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

function Step({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-4">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-caption text-accent">{index}</span>
        <span className="text-small font-medium text-ink">{title}</span>
      </div>
      <div className="mt-1.5 text-small text-ink-secondary">{children}</div>
    </div>
  );
}

export function WorkedExample({ example }: { example: ModelPerformance["example"] }) {
  const { inputs } = example;
  const [first, second] = example.outputs;
  const level = inputs.level;
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Step index={1} title="Input">
        24 h mean now {level} µg/m³, up from {inputs.lag24} a day earlier; neighbours within 50 km at {Math.round(inputs.near50)}. Regional fire power in the last 3 days {thousands(inputs.fireTotal3d)} MW, rising. Heaviest
        sector at bearing {inputs.heaviestBearing} degrees (south-south-east): {thousands(inputs.fireS3R2)} MW in the 800 to 1500 km ring, {thousands(inputs.fireS3R1)} MW in the 300 to 800 km ring,{" "}
        {NEIGHBOUR_SECTOR_MW.toLocaleString("en-GB")} MW at 300 to 800 km in the neighbouring sector. Next day&apos;s wind {WIND_MS} m/s, steady, blowing from the fires toward the station (along_fire24 ={" "}
        {inputs.alongFire24}). Rain {RAIN_24H_MM} mm next day, {inputs.rain48} mm over two. Physics smoke {Math.round(inputs.smokeNow)} now, {SMOKE_24H} at +24 h, {Math.round(inputs.smoke48h)} at +48 h.
      </Step>
      <Step index={2} title="Process">
        The 108 numbers go through the six tree sums. The strongest splits are on <Code>level</Code>, <Code>peak24</Code>, the 30 day mean, <Code>smoke_24h</Code>, <Code>slope3h</Code>, <Code>near50</Code> and
        the south-south-east 7 day fire sum, in that order of learned importance.
      </Step>
      <Step index={3} title="Output">
        Day +1 peak: {first.low} / {first.p50} / {first.high} µg/m³ (10th / 50th / 90th), API about {api(first.p50)}. Day +2: {second.low} / {second.p50} / {second.high}, API about {api(second.p50)}.
        {first.real !== null && second.real !== null ? (
          <>
            {" "}
            What happened: {first.real} on {longDay(first.day)} (API {api(first.real)}) and {second.real} on {longDay(second.day)} (API {api(second.real)}).
          </>
        ) : null}{" "}
        &quot;No change&quot; would have said {level} (API {api(level)}) both days.
      </Step>
    </div>
  );
}
