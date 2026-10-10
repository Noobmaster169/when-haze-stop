import { OutlookChart } from "@/components/map/outlook-chart";
import type { StationOutlook } from "@/lib/api/haze-schemas";
import { formatWhenShort } from "@/lib/when";

/** The stations the model expects to be worst tomorrow, each as its week of readings against the forecast and the days' bands. */

/** How much of the forecast has been checked: the readings since the issue, or the week's where no issue is showing. */
function soFar(outlook: StationOutlook): string {
  const since = outlook.source.issuedAt;
  const readings = since ? outlook.readings.filter((reading) => reading.at > since) : outlook.readings;
  const last = outlook.readings.at(-1);
  const count = `${readings.length} ${readings.length === 1 ? "reading" : "readings"} so far${since ? " since the issue" : ""}`;
  return last ? `${count}, latest ${formatWhenShort(last.at)} UTC.` : "No readings yet.";
}

/** The cursor sits at the newest reading, where known turns into forecast. */
function cursorAt(outlook: StationOutlook): number {
  const point = outlook.readings.at(-1) ?? outlook.forecast[0];
  return point ? Date.parse(point.at) : 0;
}

export function Watch({ watch }: { watch: StationOutlook[] }) {
  if (watch.length === 0) return <p className="text-small text-ink-secondary">No learned forecast names a station for tomorrow yet.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {watch.map((outlook) => (
        <div key={outlook.station.id} className="rounded-lg border border-hairline bg-surface p-4">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-small font-medium text-ink">{outlook.station.name}</div>
            <div className="text-caption text-ink-tertiary">{outlook.station.state}</div>
          </div>
          <div className="mt-2">
            <OutlookChart outlook={outlook} at={cursorAt(outlook)} />
          </div>
          <p className="mt-1 text-caption text-ink-tertiary">{soFar(outlook)}</p>
        </div>
      ))}
    </div>
  );
}
