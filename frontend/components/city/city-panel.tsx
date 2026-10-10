import { BAND_SWATCH, band, bandKey } from "@/components/map/scale";
import type { CityAir } from "@/lib/api/city-schemas";

import type { AirAt } from "./air-at";

/** The card over the scene: the hour's index, how far one could see, and where it came from. The method is in docs/FEATURES.md 4.7. */

function distance(km: number): string {
  if (km >= 50) return "50+ km";
  return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-mono text-[17px] leading-6 text-ink">{value}</p>
      <p className="text-caption text-ink-tertiary">{label}</p>
    </div>
  );
}

export function CityPanel({ air, city }: { air: AirAt; city: CityAir }) {
  return (
    <div className="w-[calc(100vw-24px)] rounded-lg border border-hairline bg-canvas/92 p-3 shadow-overlay backdrop-blur sm:w-[260px] sm:p-4">
      <h2 className="font-display text-title text-ink">{city.city.name}</h2>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className={`h-2.5 w-4 shrink-0 self-center rounded-xs ${BAND_SWATCH[bandKey(air.api)]}`} aria-hidden="true" />
        <span className="font-mono text-[22px] font-medium leading-7 text-ink">API {air.api}</span>
        <span className="text-small text-ink-secondary">{band(air.api)}</span>
      </div>
      <div className="mt-3 flex gap-6">
        <Figure value={distance(air.visibilityKm)} label="visibility, at most" />
        <Figure value={`${Math.round(air.pm25)} µg/m³`} label="PM2.5" />
      </div>
      <p className="mt-3 border-t border-hairline pt-2 text-caption text-ink-tertiary">
        From DOE {city.stations.map((station) => station.name).join(" and ")}, buildings{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
          © OpenStreetMap
        </a>
      </p>
    </div>
  );
}
