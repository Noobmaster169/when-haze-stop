import type { StationOutlook } from "@/lib/api/haze-schemas";

import { SeriesChart } from "./series-chart";

/** A station's week as DOE read it, its forecast after, and each coming day's likely peak range. */
export function OutlookChart({ outlook, at }: { outlook: StationOutlook; at: number }) {
  const ranges = outlook.days.flatMap((day) =>
    day.observedPeak === null && day.low !== null && day.high !== null ? [{ at: Date.parse(`${day.day}T12:00:00+08:00`), low: day.low, high: day.high }] : [],
  );
  return (
    <SeriesChart
      known={outlook.readings.map((point) => ({ at: Date.parse(point.at), api: point.api }))}
      ahead={outlook.forecast.map((point) => ({ at: Date.parse(point.at), api: point.api }))}
      at={at}
      ranges={ranges}
      legend={{ known: "DOE readings", ahead: "Forecast" }}
      label={`API at ${outlook.station.name} over the past week and the next three days`}
    />
  );
}
