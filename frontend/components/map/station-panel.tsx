"use client";

import Link from "next/link";
import useSWR from "swr";

import { FollowButton } from "@/components/alerts/follow-button";
import { Icon } from "@/components/ui/icons";
import { type Station, StationOutlook } from "@/lib/api/haze-schemas";
import { malaysiaWhen } from "@/lib/malaysia-time";
import { parsedFetcher } from "@/lib/poll";

import { DayTable } from "./day-table";
import { FLOATING_PANEL } from "./floating-panel";
import { OutlookChart } from "./outlook-chart";
import { BAND_SWATCH, band, bandKey } from "./scale";

/** One station: what it reads at the moment the timeline is on, its week, and its next days against the official lines. */

const fetcher = parsedFetcher(StationOutlook);


/** The stored value nearest a moment, from readings before the forecast starts and from the forecast after. */
function valueAt(outlook: StationOutlook, at: number): { api: number; forecast: boolean } | null {
  const lastRead = outlook.readings.at(-1);
  const forecast = lastRead !== undefined && at > Date.parse(lastRead.at) && outlook.forecast.length > 0;
  const series = forecast ? outlook.forecast : outlook.readings;
  let best: { api: number; away: number } | null = null;
  for (const point of series) {
    const away = Math.abs(Date.parse(point.at) - at);
    if (!best || away < best.away) best = { api: point.api, away };
  }
  return best ? { api: Math.round(best.api), forecast } : null;
}

export function StationPanel({ station, at, via, onClose }: { station: Station; at: number; via: string | null; onClose(): void }) {
  const { data: outlook, error } = useSWR(`/api/haze/stations/${station.id}`, fetcher, { refreshInterval: 300_000 });
  const value = outlook ? valueAt(outlook, at) : null;

  return (
    <aside aria-label={`${station.name} station`} className={FLOATING_PANEL}>
      <header className="flex items-start gap-2 px-5 pt-4">
        <div className="min-w-0 grow">
          <h2 className="truncate font-display text-[21px] leading-7 text-ink">{station.name}</h2>
          <p className="text-caption text-ink-tertiary">
            {station.state}, DOE station <span className="font-mono text-mono-xs">{station.id}</span>
          </p>
          {via ? <p className="text-caption text-ink-tertiary">Nearest station to {via}</p> : null}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-ink-tertiary hover:bg-active hover:text-ink">
          <Icon name="close" size={14} />
        </button>
      </header>

      {error ? <p className="px-5 py-4 text-small text-fault">This station could not be loaded.</p> : null}
      {!outlook && !error ? <p className="px-5 py-4 text-small text-ink-tertiary">Loading</p> : null}

      {outlook ? (
        <div className="space-y-4 px-5 pb-5 pt-3">
          {value ? (
            <div className="flex items-end gap-3">
              <span className="font-display text-display-lg leading-none text-ink">{value.api}</span>
              <div className="pb-0.5">
                <p className="flex items-center gap-1.5 text-strong font-medium text-ink">
                  <span aria-hidden="true" className={`h-2.5 w-4 rounded-xs ${BAND_SWATCH[bandKey(value.api)]}`} />
                  {band(value.api)}
                </p>
                <p className="text-caption text-ink-tertiary">
                  {value.forecast ? "Forecast for" : "Read at"} {malaysiaWhen(at)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-small text-ink-tertiary">This station has no readings stored yet.</p>
          )}

          <FollowButton stationId={station.id} stationName={station.name} />

          <div>
            <OutlookChart outlook={outlook} at={at} />
            <p className="text-caption text-ink-tertiary">Black is what DOE read, blue dashes the forecast.</p>
          </div>

          {outlook.days.length > 0 ? (
            <div>
              <h3 className="text-strong font-medium text-ink">Chance the day&apos;s peak passes each line</h3>
              <div className="mt-1">
                <DayTable days={outlook.days} />
              </div>
              <p className="mt-2 text-caption leading-[17px] text-ink-tertiary">
                Ranges cover 8 in 10 past errors.{" "}
                <Link href="/simulation" className="text-accent underline-offset-2 hover:underline">
                  Simulation
                </Link>
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
