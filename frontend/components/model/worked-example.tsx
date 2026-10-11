import { Tile } from "@/components/simulation/chapter";

/**
 * One real row run through the function, as three tiles. The file no longer
 * carries the example, so its figures are the ones the model's report
 * published for version 2026-10-11-c88cac5a (scores.json, example), copied
 * here rather than invented.
 */

const EXAMPLE = {
  level: 112.4,
  lag24: 43.5,
  alongFire24: 2.9,
  p50: 98.9,
  low: 97.1,
  high: 121.0,
  real: 97.2,
};

export function WorkedExample() {
  const e = EXAMPLE;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Tile figure={`${e.level}`} label={`µg/m³ now, up from ${e.lag24}; fires to the south-south-east, wind from them at ${e.alongFire24} m/s`} />
      <Tile figure={`${e.p50}`} label={`model's peak for 8 Oct, band ${e.low} to ${e.high}`} />
      <Tile figure={`${e.real}`} label={`what was read on 8 Oct; no change said ${e.level}`} />
    </div>
  );
}
