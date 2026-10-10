import type { Station, Statement, StatementPage } from "../contracts";
import type { Queryable } from "../db";
import { localDay } from "../haze/outlook";
import { type DistrictCentre, ordersFor, resolveStatements } from "../haze/statements";
import { statements } from "../repositories";
import { normalise, searchGazetteer } from "../sources/gazetteer";

/** What the government has said, once each, with what is in force today. Read by the alerts page, the job and the assistant. */

export const STATEMENT_PAGE_SIZE = 5;

/** A district named in an order, found in the gazetteer among districts and towns. */
export const districtCentre: DistrictCentre = (name) => {
  const place = searchGazetteer(name, 5).find((found) => found.kind === "district" || found.kind === "town");
  return place ? { lat: place.lat, lon: place.lon } : null;
};

/**
 * A district's own state is not covered as a whole: "schools in Batu Pahat,
 * Johor" closes Batu Pahat, not Johor. The reader is told so; this holds it
 * when the reader lists the state anyway.
 */
export function tidyAreas<T extends { states: string[]; districts: string[] }>(reading: T): T {
  const ofDistricts = new Set(
    reading.districts.flatMap((name) => searchGazetteer(name, 5).filter((place) => place.kind === "district" && normalise(place.name) === normalise(name)).map((place) => place.region)),
  );
  return { ...reading, states: reading.states.filter((state) => !ofDistricts.has(state)) };
}

export async function currentStatements(db: Queryable, now: Date): Promise<Statement[]> {
  return resolveStatements(await statements.verified(db), localDay(now));
}

export function isCurrent(statement: Statement): boolean {
  return statement.status === "in-force" || statement.status === "upcoming";
}

export async function statementPage(db: Queryable, options: { current: boolean; page: number; now: Date }): Promise<StatementPage> {
  const all = await currentStatements(db, options.now);
  const shown = options.current ? all.filter(isCurrent) : all;
  const pages = Math.max(1, Math.ceil(shown.length / STATEMENT_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page), pages);
  return { statements: shown.slice((page - 1) * STATEMENT_PAGE_SIZE, page * STATEMENT_PAGE_SIZE), page, pages, total: shown.length };
}

export function stationOrders(all: Statement[], station: Pick<Station, "name" | "state" | "lat" | "lon">): Statement[] {
  return ordersFor(all, station, districtCentre);
}
