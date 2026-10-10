import type { Pool } from "pg";

import { conditionsFor } from "../haze/alert-rules";
import { childLogger } from "../lib/logger";
import { alerts, forecasts, stations } from "../repositories";
import { outlookContext, outlookFor } from "../services/outlook";

/** After a run: say what is newly true about each station, and close what has stopped being true. */

const log = childLogger({ module: "jobs.alerts" });

export async function evaluateAlerts(pool: Pool): Promise<number> {
  const context = await outlookContext(pool);
  if (!context) return 0;
  const forecastByStation = await forecasts.stationForecasts(pool, context.runId);
  const wasOpen = await alerts.openAlerts(pool);
  const key = (stationId: string, kind: string, threshold: number): string => `${stationId}|${kind}|${threshold}`;
  const openKeys = new Set(wasOpen.map((alert) => key(alert.stationId, alert.kind, alert.threshold)));
  const holding = new Set<string>();

  let opened = 0;
  for (const station of await stations.list(pool)) {
    const outlook = await outlookFor(pool, station, context, forecastByStation.get(station.id) ?? null);
    const conditions = conditionsFor({ stationId: station.id, name: station.name, api: station.api, days: outlook.days }, (kind, threshold) =>
      openKeys.has(key(station.id, kind, threshold)),
    );
    for (const condition of conditions) {
      holding.add(key(condition.stationId, condition.kind, condition.threshold));
      if (await alerts.open(pool, condition)) opened += 1;
    }
  }

  const over = wasOpen.filter((alert) => !holding.has(key(alert.stationId, alert.kind, alert.threshold)));
  await alerts.close(pool, over.map((alert) => alert.id));
  log.info({ opened, closed: over.length }, "alerts evaluated");
  return opened;
}
