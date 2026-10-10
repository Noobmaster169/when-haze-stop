import type { VerdictMaps } from "../contracts";
import type { Queryable } from "../db";
import { ensembleMean } from "../haze/ensemble";
import { addHours, DOMAIN, distanceKm, FIELD } from "../haze/grid";
import { smokeFrom } from "../haze/smoke";
import type { Emission, Weather } from "../haze/transport";
import { TerminalError } from "../lib/errors";
import { childLogger } from "../lib/logger";
import type { FiresClient } from "../sources";
import { type Attribution, mean } from "../suppression/attribution";
import type { Complex } from "../suppression/complexes";
import type { TargetArea } from "../suppression/targets";
import { HORIZON_DAYS, type Prepared, prepare, summariseWind } from "./suppression-inputs";

/**
 * The seam between the council and the smoke engine (docs/council/06-engine-seam.md).
 *
 * The council never runs the engine itself: it gets one `Attribution` per run
 * and scores every plan from it, then asks once for the verdict's maps. This
 * implementation composes the engine's public pieces (`emissionsFor`,
 * `ensembleMean`, `smokeFrom`) and the stored run's calibration, and changes
 * none of them, so the engine can be reworked underneath it.
 */

export interface SuppressionEngine {
  attribute(request: { target: TargetArea }): Promise<Attribution>;
  /** The region's PM2.5 at one scored hour, without and with each complex's emissions scaled day by day. After `attribute`. */
  simulate(request: { keep: Map<string, number[]>; hour: number }): Promise<VerdictMaps | null>;
}

const log = childLogger({ module: "services.suppression-engine" });
/** Ensemble members per wind member: a third of the hourly run's, as only a ranking and sums are read. */
const ENSEMBLE = 3;
/** Complexes given a day-by-day contribution: the most influential, plus the ones any rule or baseline names. */
const CANDIDATES = 40;
/** A complex too small and too far to matter is not worth a pass of the engine. */
const WORTH_MW = 50;
const WORTH_KM = 500;

export interface EngineDeps {
  pool: Queryable;
  /** The FIRMS files, for detection counts and the night share; optional. */
  fires?: FiresClient;
}

/** The target's 24-hour PM2.5 from some emissions, ug/m3, for each scored hour. */
function atTarget(input: Prepared, some: Emission[], wind: Weather): Float32Array {
  const smoke = smokeFrom(ensembleMean(some, wind, ENSEMBLE), input.hours);
  const series = new Float32Array(input.span);
  for (let hour = 0; hour < input.span; hour++) {
    let sum = 0;
    for (const near of input.stationCells) sum += smoke.near(near, input.now + 1 + hour);
    series[hour] = (input.calibration.slope * sum) / input.stationCells.length;
  }
  return series;
}

async function attribution(run: Prepared, target: TargetArea): Promise<Attribution> {
  const baseline = run.members.map(({ weather }) => atTarget(run, run.emissions, weather).map((value) => value + run.calibration.intercept));
  const ceiling = run.members.map(({ weather }) => atTarget(run, run.emissions.filter((emission) => run.planDay(emission) >= 1), weather));
  log.info({ asOf: run.asOf, complexes: run.complexes.length, members: run.members.length }, "baseline and ceiling made");

  const worth = run.complexes.filter((complex) => complex.firePowerMw >= WORTH_MW || distanceKm(target.centre.lat, target.centre.lon, complex.lat, complex.lon) <= WORTH_KM);
  const share = new Map<string, number>();
  for (const complex of worth) {
    const future = (run.byComplex.get(complex.id) ?? []).filter((emission) => run.planDay(emission) >= 1);
    const shares = run.members.map(({ weather }, m) => mean(atTarget(run, future, weather)) / Math.max(1e-9, mean(ceiling[m])));
    share.set(complex.id, shares.reduce((sum, value) => sum + value, 0) / shares.length);
  }
  const chosen = candidates(run.complexes, share, target);

  const contributions = new Map<string, Float32Array[][]>();
  for (const id of chosen) {
    const byDay = new Map<number, Emission[]>();
    for (const emission of run.byComplex.get(id) ?? []) {
      const day = run.planDay(emission);
      if (day >= 1 && day <= HORIZON_DAYS) byDay.set(day, [...(byDay.get(day) ?? []), emission]);
    }
    contributions.set(
      id,
      run.members.map(({ weather }) => Array.from({ length: HORIZON_DAYS + 1 }, (_, day) => (byDay.has(day) ? atTarget(run, byDay.get(day)!, weather) : new Float32Array(run.span)))),
    );
  }
  log.info({ worth: worth.length, candidates: chosen.length }, "day-by-day contributions made");
  const winds = run.members.map(({ member, weather }) => summariseWind(member.id, weather, run.now + 1, run.hours));
  return { asOf: run.asOf.toISOString(), dayOne: run.dayOne, hours: run.span, days: HORIZON_DAYS, members: run.members.map((item) => item.member), baseline, ceiling, contributions, complexes: run.complexes, winds };
}

function maps(run: Prepared, keep: Map<string, number[]>, hour: number): VerdictMaps {
  const owner = new Map<Emission, string>();
  for (const [id, list] of run.byComplex) for (const emission of list) owner.set(emission, id);
  const scaled = run.emissions.map((emission) => {
    const day = run.planDay(emission);
    const factor = day >= 1 ? (keep.get(owner.get(emission) ?? "")?.[day - 1] ?? 1) : 1;
    return factor === 1 ? emission : { ...emission, frpMw: emission.frpMw * factor };
  });
  const cells = FIELD.nx * FIELD.ny;
  const before = new Float32Array(cells);
  const after = new Float32Array(cells);
  const at = run.now + 1 + hour;
  for (const { weather } of run.members) {
    const without = smokeFrom(ensembleMean(run.emissions, weather, ENSEMBLE), run.hours).everywhere(at);
    const withPlan = smokeFrom(ensembleMean(scaled, weather, ENSEMBLE), run.hours).everywhere(at);
    for (let cell = 0; cell < cells; cell++) {
      before[cell] += (run.calibration.intercept + run.calibration.slope * without[cell]) / run.members.length;
      after[cell] += (run.calibration.intercept + run.calibration.slope * withPlan[cell]) / run.members.length;
    }
  }
  const bytes = (field: Float32Array) => Buffer.from(Uint8Array.from(field, (value) => Math.max(0, Math.min(255, Math.round(value))))).toString("base64");
  return {
    at: addHours(run.asOf, hour + 1).toISOString(),
    grid: { lon0: DOMAIN.lon0, lat0: DOMAIN.lat0, step: FIELD.step, nx: FIELD.nx, ny: FIELD.ny },
    before: bytes(before),
    after: bytes(after),
    note: "The engine's smoke and calibration, averaged over the wind members, without the map's corrections towards the stations' readings.",
  };
}

export function engineSuppression(deps: EngineDeps): SuppressionEngine {
  let prepared: Prepared | null = null;
  return {
    async attribute({ target }) {
      prepared = await prepare(deps.pool, target, deps.fires);
      return attribution(prepared, target);
    },
    async simulate({ keep, hour }) {
      if (!prepared) throw new TerminalError("simulate was asked before attribute");
      return maps(prepared, keep, hour);
    },
  };
}

/** The most influential complexes, every Malaysian one that reaches the target, and the biggest and nearest in Kalimantan, which the baselines use. */
function candidates(complexes: Complex[], share: Map<string, number>, target: TargetArea): string[] {
  const ranked = [...share].sort((a, b) => b[1] - a[1]);
  const chosen = new Set(ranked.slice(0, CANDIDATES).map(([id]) => id));
  for (const [id, value] of ranked) if (value > 0.001 && complexes.find((complex) => complex.id === id)?.place.country === "Malaysia") chosen.add(id);
  const kalimantan = complexes.filter((complex) => complex.place.area === "kalimantan");
  const biggest = [...kalimantan].sort((a, b) => b.firePowerMw - a.firePowerMw)[0];
  const km = (complex: Complex) => distanceKm(target.centre.lat, target.centre.lon, complex.lat, complex.lon);
  const nearest = [...kalimantan].sort((a, b) => km(a) - km(b))[0];
  if (biggest) chosen.add(biggest.id);
  if (nearest) chosen.add(nearest.id);
  return [...chosen];
}
