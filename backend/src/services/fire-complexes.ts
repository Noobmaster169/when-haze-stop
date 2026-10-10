import type { Queryable } from "../db";
import type { Detection, FireCellDay } from "../haze/fires";
import { childLogger } from "../lib/logger";
import { council } from "../repositories";
import type { FiresClient } from "../sources";
import { peatShare } from "../sources/peat";
import { placeOf } from "../sources/place-namer";
import { type CellFacts, type Complex, findComplexes, recentCells } from "../suppression/complexes";

/**
 * The fire complexes the council reasons over, from what is stored: each cell
 * at its mean of the last three known days (the rate the engine carries it
 * forward at), with how long it has burned, how much of it is peat, and, where
 * the satellite files can be read, how many detections and how many at night.
 */

const log = childLogger({ module: "services.fire-complexes" });
const RECENT_DAYS = 3;
const HISTORY_DAYS = 30;

const dayBefore = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
const key = (lat10: number, lon10: number) => `${lat10}|${lon10}`;

/** Detections per cell per satellite-day, and the night share, from the files' newest days. */
function countDetections(detections: Detection[], fromDay: string, toDay: string): Map<string, { all: number; night: number }> {
  const counts = new Map<string, { all: number; night: number }>();
  const passes = new Set<string>();
  for (const hit of detections) {
    if (hit.day < fromDay || hit.day > toDay) continue;
    passes.add(`${hit.satellite}|${hit.day}`);
    const cell = key(Math.floor(hit.lat * 10), Math.floor(hit.lon * 10));
    const count = counts.get(cell) ?? { all: 0, night: 0 };
    count.all += 1;
    if (!hit.daytime) count.night += 1;
    counts.set(cell, count);
  }
  // Three satellites see the same fire; a day's detections are the mean over the passes, not their sum.
  const perDay = Math.max(1, passes.size);
  return new Map([...counts].map(([cell, count]) => [cell, { all: count.all / perDay, night: count.night / perDay }]));
}

export interface ComplexSituation {
  /** The last complete UTC day of fires. */
  lastKnownDay: string;
  complexes: Complex[];
}

/**
 * `cells` are the stored cell-days the engine will burn; `lastKnownDay` the
 * newest complete one. `fires` is optional: without it detections are
 * estimated from fire power and the night share is unknown.
 */
export async function complexesFrom(db: Queryable, cells: FireCellDay[], lastKnownDay: string, fires?: FiresClient): Promise<ComplexSituation> {
  const fromDay = dayBefore(lastKnownDay, RECENT_DAYS - 1);
  const recent = recentCells(cells.filter((cell) => cell.day >= fromDay && cell.day <= lastKnownDay));
  const days = await council.daysBurning(db, dayBefore(lastKnownDay, HISTORY_DAYS - 1), lastKnownDay);

  let counted = new Map<string, { all: number; night: number }>();
  if (fires) {
    try {
      counted = countDetections(await fires.recent(), fromDay, lastKnownDay);
    } catch (error) {
      // The files only refine the estimate: a council run goes ahead on fire power when they cannot be read.
      log.warn({ err: error instanceof Error ? error.message : String(error) }, "satellite files unreadable, estimating detections from fire power");
    }
  }

  const facts: CellFacts = {
    daysBurning: (lat10, lon10) => days.get(key(lat10, lon10)) ?? 0,
    detections: (lat10, lon10) => counted.get(key(lat10, lon10)) ?? null,
    peatShare,
  };
  return { lastKnownDay, complexes: findComplexes(recent, facts, placeOf) };
}
