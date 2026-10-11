"use client";

import { useMemo } from "react";

import { Icon } from "@/components/ui/icons";
import { malaysiaWhen } from "@/lib/malaysia-time";

import type { Basemap } from "./basemap";
import { sampleField } from "./field";
import { FLOATING_PANEL } from "./floating-panel";
import { distanceKm } from "./geo";
import { apiAt, type MapData } from "./map-data";
import type { Probe } from "./probe-tip";
import { BAND_SWATCH, band, bandKey } from "./scale";
import { SeriesChart } from "./series-chart";

/**
 * Any spot on the map: the model's value there at the timeline's moment, and
 * its whole run as a chart, read from the frames the map already holds, so it
 * opens at once and moves as the timeline plays.
 */

/** Past this, a spot's value is mostly the model: the readings pulling it fade out by 200 km. */
const FAR_KM = 60;
const NEAR_TOWN_KM = 40;

function coordinates(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}°E`;
}

function nearestTown(basemap: Basemap | null, lat: number, lon: number): { name: string; km: number } | null {
  let best: { name: string; km: number } | null = null;
  for (const place of basemap?.places ?? []) {
    const km = distanceKm(lat, lon, place.lat, place.lon);
    if (km <= NEAR_TOWN_KM && (!best || km < best.km)) best = { name: place.name, km: Math.round(km) };
  }
  return best;
}

export function PointPanel({ data, basemap, probe, at, onStation, onClose }: { data: MapData; basemap: Basemap | null; probe: Probe; at: number; onStation(id: string): void; onClose(): void }) {
  const { lon, lat } = probe;
  const series = useMemo(() => data.times.map((time, index) => ({ at: time, api: sampleField(data.fields[index], data.grid, lon, lat) })), [data, lon, lat]);
  const known = series.filter((point) => point.at <= data.asOf);
  const ahead = series.filter((point) => point.at > data.asOf);
  const api = Math.round(apiAt(data, at, lon, lat));
  const town = probe.name ? null : nearestTown(basemap, lat, lon);
  const nearest = probe.nearest;

  return (
    <aside aria-label="This spot on the map" className={FLOATING_PANEL}>
      <header className="flex items-start gap-2 px-5 pt-4">
        <div className="min-w-0 grow">
          <h2 className="truncate font-display text-[21px] leading-7 text-ink">{probe.name ?? coordinates(lat, lon)}</h2>
          <p className="text-caption text-ink-tertiary">
            {probe.name ? coordinates(lat, lon) : town ? `${town.km === 0 ? "At" : `${town.km} km from`} ${town.name}` : "Model estimate"}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-ink-tertiary hover:bg-active hover:text-ink">
          <Icon name="close" size={14} />
        </button>
      </header>

      <div className="space-y-4 px-5 pb-5 pt-3">
        <div className="flex items-end gap-3">
          <span className="font-display text-display-lg leading-none text-ink">{api}</span>
          <div className="pb-0.5">
            <p className="flex items-center gap-1.5 text-strong font-medium text-ink">
              <span aria-hidden="true" className={`h-2.5 w-4 rounded-xs ${BAND_SWATCH[bandKey(api)]}`} />
              {band(api)}
            </p>
            <p className="text-caption text-ink-tertiary">
              {at > data.asOf ? "Forecast for" : "Model estimate at"} {malaysiaWhen(at)}
            </p>
          </div>
        </div>

        {nearest ? (
          <button type="button" onClick={() => onStation(nearest.id)} className="flex w-full items-center gap-2 rounded-md border border-hairline px-3 py-2 text-left text-small hover:bg-active">
            <Icon name="pin" size={14} className="shrink-0 text-ink-tertiary" />
            <span className="grow">
              <span className="text-ink">Nearest station: {nearest.name}</span>
              <span className="text-ink-tertiary">, {nearest.km} km</span>
            </span>
            <Icon name="right" size={13} className="text-ink-tertiary" />
          </button>
        ) : null}

        <SeriesChart known={known} ahead={ahead} at={at} legend={{ known: "Model", ahead: "Forecast" }} label={`Modelled API at ${coordinates(lat, lon)} over the past week and the next three days`} />

        <p className="text-caption leading-[17px] text-ink-tertiary">
          {nearest && nearest.km > FAR_KM
            ? `Mostly the model: the nearest station is ${nearest.km} km away.`
            : "No station here: this is the model, corrected by nearby readings."}
        </p>
      </div>
    </aside>
  );
}
