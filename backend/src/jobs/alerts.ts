import type { Pool } from "pg";

import type { AlertKind } from "../contracts";
import { alertFor, type Condition } from "../haze/alert-rules";
import { childLogger } from "../lib/logger";
import { alerts, forecasts, stations } from "../repositories";
import type { PushSender } from "../sources";
import { stationView } from "../services/areas";
import { outlookContext } from "../services/outlook";
import { currentStatements } from "../services/statements";

/**
 * After a run: raise the one alert worth raising for each station, close what
 * has stopped being true or been outranked, and notify the devices following a
 * station whose alert is new.
 */

const log = childLogger({ module: "jobs.alerts" });

const TITLES: Record<AlertKind, string> = {
  order: "Official order",
  arriving: "Haze forecast",
  clearing: "Haze clearing",
  observed: "Haze now",
};

async function notify(pool: Pool, push: PushSender, raised: Condition[]): Promise<number> {
  const targets = await alerts.pushTargets(pool, raised.map((condition) => condition.stationId));
  let sent = 0;
  for (const target of targets) {
    const condition = raised.find((item) => item.stationId === target.stationId);
    if (!condition) continue;
    try {
      const delivered = await push.send(target.push, { title: TITLES[condition.kind], body: condition.message, url: "/alerts", tag: `haze-${condition.stationId}` });
      if (delivered) sent += 1;
      else await alerts.forgetPush(pool, target.push.endpoint);
    } catch (error) {
      // One device the push service refused does not stop the others hearing.
      log.warn({ station: target.stationId, err: error instanceof Error ? error.message : String(error) }, "a notification was not sent");
    }
  }
  return sent;
}

export async function evaluateAlerts(pool: Pool, push: PushSender | null = null, now: Date = new Date()): Promise<number> {
  const context = await outlookContext(pool);
  const statements = await currentStatements(pool, now);
  const forecastByStation = context ? await forecasts.stationForecasts(pool, context.runId) : new Map<string, number[]>();
  const wasOpen = await alerts.openAlerts(pool);
  const key = (stationId: string, kind: string, threshold: number): string => `${stationId}|${kind}|${threshold}`;
  const openKeys = new Set(wasOpen.map((alert) => key(alert.stationId, alert.kind, alert.threshold)));
  const holding = new Set<string>();
  const raised: Condition[] = [];

  for (const station of await stations.list(pool)) {
    const view = await stationView(pool, station, context, statements, forecastByStation.get(station.id) ?? null);
    const state = { stationId: station.id, name: station.name, api: station.api, days: view.outlook?.days ?? [], yesterdayPeak: view.yesterdayPeak, orders: view.orders };
    const condition = alertFor(state, (kind, threshold) => openKeys.has(key(station.id, kind, threshold)));
    if (!condition) continue;
    holding.add(key(condition.stationId, condition.kind, condition.threshold));
    if (await alerts.open(pool, condition)) raised.push(condition);
  }

  const over = wasOpen.filter((alert) => !holding.has(key(alert.stationId, alert.kind, alert.threshold)));
  await alerts.close(pool, over.map((alert) => alert.id));
  const sent = push && raised.length > 0 ? await notify(pool, push, raised) : 0;
  log.info({ opened: raised.length, closed: over.length, notified: sent }, "alerts evaluated");
  return raised.length;
}
