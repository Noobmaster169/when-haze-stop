import type { StationOutlook } from "@/lib/api/haze-schemas";

import { SeriesChart } from "./series-chart";

/** A station's week as DOE read it and its forecast after. */
export function OutlookChart({ outlook, at }: { outlook: StationOutlook; at: number }) {
  return (
    <SeriesChart
      known={outlook.readings.map((point) => ({ at: Date.parse(point.at), api: point.api }))}
      ahead={outlook.forecast.map((point) => ({ at: Date.parse(point.at), api: point.api }))}
      at={at}
      label={`API at ${outlook.station.name} over the past week and the next three days`}
    />
  );
}
