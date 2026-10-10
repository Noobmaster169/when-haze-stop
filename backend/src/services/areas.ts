import type { AreaCard, Station, StationOutlook, Statement } from "../contracts";
import type { Queryable } from "../db";
import { dayPeak } from "../haze/closing";
import { addHours } from "../haze/grid";
import { headlineFor } from "../haze/headline";
import { localDay } from "../haze/outlook";
import { alerts, stations } from "../repositories";
import { type OutlookContext, outlookContext, outlookFor } from "./outlook";
import { currentStatements, stationOrders } from "./statements";

/**
 * A station as the alerts see it: its outlook, the peak of the day before, and
 * the orders that cover it. The job and the alerts page both read it here.
 */

export interface StationView {
  station: Station;
  outlook: StationOutlook | null;
  yesterdayPeak: number | null;
  orders: Statement[];
}

export async function stationView(db: Queryable, station: Station, context: OutlookContext | null, statements: Statement[], forecastApi?: number[] | null): Promise<StationView> {
  const orders = stationOrders(statements, station);
  if (!context) return { station, outlook: null, yesterdayPeak: null, orders };
  const outlook = await outlookFor(db, station, context, forecastApi);
  return { station, outlook, yesterdayPeak: dayPeak(outlook.readings, localDay(addHours(context.asOf, -24))), orders };
}

/** One card per area the session follows, in the order it followed them. */
export async function areaCards(db: Queryable, sessionId: string, now: Date): Promise<AreaCard[]> {
  const follows = await alerts.subscriptions(db, sessionId);
  if (follows.length === 0) return [];
  const context = await outlookContext(db);
  const statements = await currentStatements(db, now);
  const open = await alerts.openEvents(db, follows.map((follow) => follow.stationId));

  const cards: AreaCard[] = [];
  for (const follow of follows) {
    const station = await stations.find(db, follow.stationId);
    if (!station) continue;
    const view = await stationView(db, station, context, statements);
    const days = view.outlook?.days ?? [];
    cards.push({
      stationId: station.id,
      stationName: station.name,
      state: station.state,
      api: station.api,
      observedAt: station.observedAt,
      headline: headlineFor({ api: station.api, days, yesterdayPeak: view.yesterdayPeak }),
      days,
      alert: open.find((event) => event.stationId === station.id) ?? null,
      orders: view.orders,
    });
  }
  return cards;
}
