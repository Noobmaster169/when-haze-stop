import type { RefObject } from "react";

import { malaysiaWhen } from "@/lib/malaysia-time";

import { band } from "./scale";

/**
 * What the model says about a spot that is not a station. Moved by the map
 * directly through its ref as the map is dragged, so it stays on its point.
 */

export interface Probe {
  lon: number;
  lat: number;
  nearest: { id: string; name: string; km: number } | null;
}

export function ProbeTip({ anchor, api, at, probe, onStation }: { anchor: RefObject<HTMLDivElement | null>; api: number; at: number; probe: Probe; onStation(id: string): void }) {
  return (
    <div ref={anchor} className="pointer-events-none absolute left-0 top-0 z-10 w-max max-w-[240px]" style={{ visibility: "hidden" }}>
      <div className="pointer-events-auto ml-3 -translate-y-1/2 rounded-lg border border-hairline bg-canvas px-3 py-2 shadow-overlay">
        <p className="text-strong font-medium text-ink">
          API {Math.round(api)}, {band(api)}
        </p>
        <p className="text-caption text-ink-tertiary">Model estimate, {malaysiaWhen(at)}</p>
        {probe.nearest ? (
          <button type="button" onClick={() => onStation(probe.nearest?.id ?? "")} className="mt-1 text-caption text-accent underline-offset-2 hover:underline">
            Nearest station: {probe.nearest.name}, {probe.nearest.km} km
          </button>
        ) : null}
      </div>
    </div>
  );
}
