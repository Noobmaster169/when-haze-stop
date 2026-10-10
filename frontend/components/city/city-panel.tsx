import { band, bandKey, type BandKey } from "@/components/map/scale";
import type { CityAir } from "@/lib/api/city-schemas";

import type { AirAt } from "./air-at";

/** The card over the scene: the hour's index, what it means for the eye, and where every number came from. */

const SWATCH: Record<BandKey, string> = {
  good: "bg-api-0",
  moderate: "bg-api-50",
  unhealthy: "bg-api-150",
  "very-unhealthy": "bg-api-200",
  hazardous: "bg-api-300",
};

function distance(km: number): string {
  if (km >= 50) return "more than 50 km";
  if (km >= 10) return `about ${Math.round(km)} km`;
  return `about ${km.toFixed(1)} km`;
}

export function CityPanel({ air, city, estimatedShare }: { air: AirAt; city: CityAir; estimatedShare: number }) {
  const sources = city.stations.map((station) => `${station.name} (${station.km} km, ${Math.round(station.share * 100)}%)`).join(" and ");
  return (
    <div className="w-[calc(100vw-24px)] rounded-lg border border-hairline bg-canvas/92 p-3 shadow-overlay backdrop-blur sm:w-[300px] sm:p-4">
      <h2 className="font-display text-title text-ink">{city.city.name}</h2>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`h-2.5 w-2.5 shrink-0 self-center rounded-full ${SWATCH[bandKey(air.api)]}`} aria-hidden="true" />
        <span className="font-mono text-[22px] font-medium leading-7 text-ink">API {air.api}</span>
        <span className="text-small text-ink-secondary">{band(air.api)}</span>
      </div>
      <p className="mt-1 text-small text-ink-secondary">PM2.5 about {Math.round(air.pm25)} µg/m³, as a 24 hour mean.</p>

      <p className="mt-3 text-body text-ink">
        One could see <span className="font-medium">{distance(air.visibilityKm)}</span>.
      </p>
      <p className="mt-1 hidden text-caption text-ink-tertiary sm:block">
        An estimate from how smoke scatters light, at an assumed {Math.round(city.humidity * 100)}% humidity. In past Malaysian haze the visibility reported was two to five times shorter than this at the same index, so read it as the most one could see.
      </p>

      <p className="mt-1 text-caption text-ink-tertiary sm:hidden">An estimate from optics; real haze has often been thicker.</p>
      <p className="mt-3 border-t border-hairline pt-2 text-caption text-ink-tertiary">
        <span className="hidden sm:inline">Blended from DOE&apos;s {sources}. </span>Buildings ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
          OpenStreetMap contributors
        </a>
        <span className="hidden sm:inline">; {Math.round(estimatedShare * 100)}% of their heights are guessed from the kind of building</span>.
      </p>
    </div>
  );
}
