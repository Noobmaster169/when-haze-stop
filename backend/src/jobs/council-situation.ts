import { closePool, getPool } from "../db";
import { firmsClient } from "../sources";
import { shareOfCeiling } from "../suppression/attribution";
import { biggestFirst, greedy, nearestFirst } from "../suppression/baselines";
import { scorePlan } from "../suppression/score";
import { TARGETS } from "../suppression/targets";
import { engineSuppression } from "../services/suppression-engine";

/**
 * Stage 0 of a council run, printed: the complexes that reach the target, how
 * much of its coming smoke each causes, and what the baselines would do.
 * `pnpm council:situation` (add `--no-files` to skip the FIRMS download).
 */

const target = TARGETS["klang-valley"];
const pool = getPool();
const started = Date.now();
const attribution = await engineSuppression({ pool, fires: process.argv.includes("--no-files") ? undefined : firmsClient() }).attribute({ target });
const seconds = Math.round((Date.now() - started) / 1000);

const pct = (value: number) => `${(100 * value).toFixed(2)}%`;
console.log(`${target.name}, data as of ${attribution.asOf}, plan day 1 = ${attribution.dayOne}, made in ${seconds} s`);
for (const [m, member] of attribution.members.entries()) {
  const ceiling = attribution.ceiling[m].reduce((sum, value) => sum + value, 0) / attribution.hours;
  console.log(`  ${member.id}: ${member.label}; ceiling ${ceiling.toFixed(2)} ug/m3`);
}
const rows = [...attribution.contributions.keys()]
  .map((id) => {
    const complex = attribution.complexes.find((item) => item.id === id)!;
    const shares = attribution.members.map((_, m) => shareOfCeiling(attribution, id, m));
    return { complex, shares, mean: shares.reduce((sum, value) => sum + value, 0) / shares.length };
  })
  .sort((a, b) => b.mean - a.mean);
console.table(
  rows.slice(0, 25).map(({ complex, shares }) => ({
    id: complex.id,
    place: `${complex.place.name}, ${complex.place.province}`,
    mw: Math.round(complex.firePowerMw),
    detections: Math.round(complex.detections),
    days: complex.persistenceDays,
    peat: complex.peatShare.toFixed(2),
    night: complex.nightShare === null ? "" : complex.nightShare.toFixed(2),
    share: shares.map(pct).join(" / "),
  })),
);
const plans = [biggestFirst(attribution.complexes), nearestFirst(attribution.complexes, target.centre), greedy(attribution)];
for (const plan of plans) {
  if (!plan) continue;
  const score = scorePlan(plan, attribution);
  console.log(`${plan.title}: expected ${pct(score.expected)}, worst wind ${pct(score.worstWind)}, pessimistic ${pct(score.pessimistic)}, optimistic ${pct(score.optimistic)}`);
  console.log(`    ${plan.assignments.map((line) => `${line.complexId} ${line.asset} x${line.units} d${line.fromDay}-${line.toDay}`).join("; ")}`);
}
await closePool();
