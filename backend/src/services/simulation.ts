import type { Simulation } from "../contracts";
import type { Queryable } from "../db";
import { BAND_EDGES } from "../haze/api-index";
import { arrivals, backtest, type ReadingGrid } from "../haze/backtest";
import { MEMBERS } from "../haze/ensemble";
import { addHours, hoursBetween, WEATHER_POINTS } from "../haze/grid";
import { fires, forecasts, readings, stations, weather } from "../repositories";

/**
 * Everything the Simulation page shows, worked out from the database on each
 * request: the newest run's inputs, DOE's index against this period's
 * readings, and the station forecast replayed at every stored hour against
 * "no change". Nothing is stored or hard-coded, so the proof grows with the data.
 */

const BIN = 5;
/** The per-day comparison is made at this lead: far enough ahead to matter, near enough to be checked every day. */
const DAY_LEAD = 6;
const REPLAY_HOURS = 24;
const REPLAYS = 4;

export async function simulation(db: Queryable): Promise<Simulation> {
  const oldest = await readings.oldestAt(db);
  const newest = await readings.newestAt(db);
  const all = oldest && newest ? await readings.between(db, oldest, newest) : [];
  const named = new Map((await stations.list(db)).map((station) => [station.id, station.name]));

  const grid: ReadingGrid = { first: oldest ?? new Date(0), stations: new Map() };
  const hours = oldest && newest ? hoursBetween(oldest, newest) + 1 : 0;
  const bins = new Map<number, number>();
  for (const reading of all) {
    let series = grid.stations.get(reading.stationId);
    if (!series) {
      series = new Float32Array(hours).fill(Number.NaN);
      grid.stations.set(reading.stationId, series);
    }
    series[hoursBetween(grid.first, reading.observedAt)] = reading.api;
    const bin = Math.floor(reading.api / BIN) * BIN;
    bins.set(bin, (bins.get(bin) ?? 0) + 1);
  }

  const { leads, days } = backtest(grid, DAY_LEAD);
  const replays = arrivals(grid, REPLAY_HOURS, REPLAYS);
  const latest = await forecasts.latest(db);
  const fireDay = latest ? addHours(new Date(`${latest.asOf.slice(0, 10)}T00:00:00Z`), -24).toISOString().slice(0, 10) : null;
  const burning = fireDay ? await fires.dayTotal(db, fireDay) : { cells: 0, frpMw: 0 };
  const iso = (at: Date): string => at.toISOString();

  return {
    period: { from: oldest ? iso(oldest) : null, to: newest ? iso(newest) : null, stations: grid.stations.size, readings: all.length },
    run: latest
      ? {
          asOf: latest.asOf,
          rankCorrelation: latest.rankCorrelation,
          pairs: latest.pairs,
          members: MEMBERS,
          fireDay,
          fireCells: burning.cells,
          firePowerMw: burning.frpMw,
          weatherHours: await weather.hoursStored(db),
          weatherPoints: WEATHER_POINTS,
        }
      : null,
    bands: BAND_EDGES.map(([pm25, api]) => [pm25, api] as [number, number]),
    histogram: [...bins].sort((a, b) => a[0] - b[0]).map(([api, count]) => ({ api, count })),
    binWidth: BIN,
    skill: leads,
    dayLead: DAY_LEAD,
    days,
    arrivals: replays.map((item) => ({
      stationId: item.stationId,
      stationName: named.get(item.stationId) ?? item.stationId,
      madeAt: iso(item.madeAt),
      readings: item.readings.map((point) => ({ at: iso(point.at), api: point.api })),
      forecast: item.forecast.map((point) => ({ at: iso(point.at), api: Math.round(point.api * 10) / 10 })),
      model: item.model,
      persistence: item.persistence,
    })),
  };
}
