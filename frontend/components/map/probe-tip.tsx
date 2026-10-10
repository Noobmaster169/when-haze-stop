import type { RefObject } from "react";

import { malaysiaWhen } from "@/lib/malaysia-time";

import { band } from "./scale";

/**
 * The value at a spot that is not a station, beside its pin. Moved by the map
 * directly through its ref as the map is dragged, so it stays on its point.
 * The panel beside the map says the rest.
 */

export interface Probe {
  lon: number;
  lat: number;
  /** What was searched for, when the spot came from the search box. */
  name: string | null;
  nearest: { id: string; name: string; km: number } | null;
}

export function ProbeTip({ anchor, api, at }: { anchor: RefObject<HTMLDivElement | null>; api: number; at: number }) {
  return (
    <div ref={anchor} className="pointer-events-none absolute left-0 top-0 z-10 w-max" style={{ visibility: "hidden" }}>
      <p className="ml-3 -translate-y-1/2 rounded-md border border-hairline bg-canvas px-2.5 py-1 text-small shadow-overlay">
        <span className="font-medium text-ink">
          API {Math.round(api)}, {band(api)}
        </span>
        <span className="ml-2 text-ink-tertiary">{malaysiaWhen(at)}</span>
      </p>
    </div>
  );
}
