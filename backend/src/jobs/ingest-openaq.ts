import type { Pool } from "pg";

import { addHours } from "../haze/grid";
import { UpstreamError } from "../lib/errors";
import { childLogger } from "../lib/logger";
import { openaq, sourceFetches } from "../repositories";
import type { OpenAqClient, OpenAqSensor } from "../sources/openaq";
import { recordFetch } from "./record-fetch";

/**
 * OpenAQ's PM2.5, from both ends of what is stored. The hourly cycle asks each
 * sensor forward from its newest stored hour; the history asks backward from
 * its oldest to the first day wanted. So the hours of a sensor are always one
 * unbroken run, whichever of the two ran first and wherever either stopped.
 */

const log = childLogger({ module: "jobs.ingest-openaq" });

/** One request holds a thousand hours, which is forty days with room to spare. */
const WINDOW_MS = 40 * 24 * 3_600_000;
/** Where a sensor with nothing stored starts in the hourly cycle: the history, not the cycle, goes further back. */
const RECENT_HOURS = 72;

export interface OpenAqDeps {
  pool: Pool;
  openaq: OpenAqClient;
}

interface Tally {
  requests: number;
  hours: number;
  added: number;
}

/** Asks one sensor for a span, a window at a time, newest window first when `backward`. A failure stops it, keeping what came before. */
async function fetchSpan(deps: OpenAqDeps, sensor: OpenAqSensor, from: number, to: number, backward: boolean, tally: Tally): Promise<void> {
  for (let edge = backward ? to : from; backward ? edge > from : edge < to; edge += backward ? -WINDOW_MS : WINDOW_MS) {
    const start = backward ? Math.max(from, edge - WINDOW_MS) : edge;
    const end = backward ? edge : Math.min(to, edge + WINDOW_MS);
    const found = await deps.openaq.hours(sensor.sensorId, new Date(start), new Date(end));
    tally.requests += 1;
    tally.hours += found.length;
    tally.added += await openaq.insertHours(deps.pool, found);
  }
}

/**
 * Runs `work` for every sensor. OpenAQ answers 500 for a few sensors every
 * time while serving the rest, so a sensor it refuses is logged and the
 * others still run. No answer at all is the link or the whole service, and
 * stops the fetch: the next run picks up where this one got to.
 */
async function eachSensor(sensors: OpenAqSensor[], work: (sensor: OpenAqSensor) => Promise<void>): Promise<number[]> {
  const done: number[] = [];
  for (const sensor of sensors) {
    try {
      await work(sensor);
      done.push(sensor.sensorId);
    } catch (error) {
      if (!(error instanceof UpstreamError)) throw error;
      log.error({ sensorId: sensor.sensorId, sensor: sensor.name, err: error.message }, "a sensor's hours could not be fetched");
    }
  }
  return done;
}

/** The hours each reporting sensor has added since its newest stored one. Returns how many were new. */
export async function ingestOpenAq(deps: OpenAqDeps, now: Date): Promise<number> {
  const recent = addHours(now, -RECENT_HOURS);
  const detail = await recordFetch(deps.pool, "openaq", async () => {
    const sensors = (await deps.openaq.sensors()).filter((sensor) => sensor.lastAt !== null && sensor.lastAt > recent);
    await openaq.upsertSensors(deps.pool, sensors);
    const { newest } = await openaq.spanBySensor(deps.pool);
    const tally = { requests: 0, hours: 0, added: 0 };
    const done = await eachSensor(sensors, (sensor) => {
      const from = newest.get(sensor.sensorId)?.getTime() ?? recent.getTime();
      return fetchSpan(deps, sensor, from, Math.min(now.getTime(), sensor.lastAt?.getTime() ?? 0), false, tally);
    });
    return { sensors: sensors.length, sensorsFailed: sensors.length - done.length, ...tally };
  });
  log.info(detail, "OpenAQ hours stored");
  return detail.added;
}

/**
 * Every sensor's hours from `fromDay` up to its oldest stored one, and from
 * its newest to the last it reported. A sensor that got through both is
 * recorded as done, so the next run does not ask again for the months in
 * which it measured nothing.
 */
export async function ingestOpenAqHistory(deps: OpenAqDeps, fromDay: string, now: Date): Promise<number> {
  const first = new Date(`${fromDay}T00:00:00Z`);
  const finished = new Set(
    (await sourceFetches.succeeded(deps.pool, "openaq"))
      .filter((detail) => detail.feed === "history" && detail.from === fromDay)
      .flatMap((detail) => String(detail.done).split(",")),
  );
  const detail = await recordFetch(deps.pool, "openaq", async () => {
    const all = (await deps.openaq.sensors()).filter((sensor) => sensor.lastAt !== null && sensor.lastAt > first);
    await openaq.upsertSensors(deps.pool, all);
    const sensors = all.filter((sensor) => !finished.has(String(sensor.sensorId)));
    const { oldest, newest } = await openaq.spanBySensor(deps.pool);
    const tally = { requests: 0, hours: 0, added: 0 };
    const done = await eachSensor(sensors, async (sensor) => {
      const from = Math.max(first.getTime(), sensor.firstAt?.getTime() ?? 0);
      const last = Math.min(now.getTime(), sensor.lastAt?.getTime() ?? 0);
      await fetchSpan(deps, sensor, from, oldest.get(sensor.sensorId)?.getTime() ?? last, true, tally);
      // A sensor that has since gone quiet is never asked by the hourly cycle, so its newest end is closed here.
      const top = newest.get(sensor.sensorId)?.getTime();
      if (top !== undefined) await fetchSpan(deps, sensor, top, last, false, tally);
    });
    return { feed: "history", from: fromDay, sensors: sensors.length, sensorsFailed: sensors.length - done.length, done: done.join(","), ...tally };
  });
  log.info(detail, "OpenAQ history stored");
  return detail.added;
}
