"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { type Basemap, loadBasemap } from "@/components/map/basemap";
import { parseHex, STOP_VALUES } from "@/components/map/scale";
import { readTheme } from "@/components/map/theme";
import type { Verdict } from "@/lib/api/council-schemas";
import { malaysiaWhen } from "@/lib/malaysia-time";

import { fieldImage, fitBounds, gridBounds, placeNamed, removal, removalImage, strikePoints } from "./map-geometry";
import { MapPanel } from "./map-panel";
import { decodeBytes } from "./pm25";

/**
 * Before and after: the engine's 24-hour PM2.5 over the region at the hour the
 * plan helps most, without the plan and with it, on the map's own index
 * colours, and a third map of the difference on its own scale, because a plan
 * that removes a few ug/m3 from a field of hundreds leaves the first two
 * looking alike. A verdict without maps gets the outline and the strikes alone.
 */

function watchTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function useBasemap(): Basemap | null {
  const [basemap, setBasemap] = useState<Basemap | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const loaded = await loadBasemap("/basemap.json");
        if (!cancelled) setBasemap(loaded);
      } catch (error) {
        // The strikes still draw on a plain ground; the coasts are context, not data.
        console.error("[council] the basemap did not load:", error);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);
  return basemap;
}

function RemovedLegend({ max }: { max: number }) {
  return (
    <div className="flex items-center gap-2 text-caption text-ink-tertiary">
      <span className="tabular-nums">0</span>
      <span className="h-1.5 w-32 rounded-sm" style={{ background: "linear-gradient(to right, transparent, var(--signal))" }} />
      <span className="tabular-nums">{max.toFixed(0)} ug/m3 less</span>
    </div>
  );
}

function ApiLegend() {
  return (
    <div className="flex items-center gap-2 text-caption text-ink-tertiary">
      <span>API</span>
      <span className="flex overflow-hidden rounded-sm">
        {STOP_VALUES.map((value) => (
          <span key={value} className="flex w-9 flex-col items-center">
            <span className="h-1.5 w-full" style={{ background: `var(--api-${value})` }} />
            <span className="mt-0.5 tabular-nums">{value}</span>
          </span>
        ))}
      </span>
    </div>
  );
}

export function VerdictMap({ verdict }: { verdict: Verdict }) {
  const basemap = useBasemap();
  // Null while hydrating: the field is painted from the scheme's colours, which only the browser knows.
  const theme = useSyncExternalStore<string | null>(watchTheme, () => document.documentElement.dataset.theme ?? "light", () => null);
  const strikes = strikePoints(verdict.strikeList);
  const maps = verdict.maps;
  const images = useMemo(() => {
    if (!maps || theme === null) return null;
    const style = getComputedStyle(document.documentElement);
    const stops = readTheme(document.documentElement).stops;
    const before = decodeBytes(maps.before);
    const after = decodeBytes(maps.after);
    const removed = removal(before, after);
    return {
      before: fieldImage(before, maps.grid, stops),
      after: fieldImage(after, maps.grid, stops),
      removed: removalImage(removed.cells, removed.max, maps.grid, parseHex(style.getPropertyValue("--signal"))),
      max: removed.max,
      theme,
    };
  }, [maps, theme]);

  if (maps) {
    const bounds = gridBounds(maps.grid);
    return (
      <div>
        <div className="grid gap-4 md:grid-cols-2">
          <MapPanel bounds={bounds} basemap={basemap} strikes={strikes} image={images?.before ?? null} ground="field" label="Without the plan" />
          <MapPanel bounds={bounds} basemap={basemap} strikes={strikes} image={images?.after ?? null} ground="field" label="With the plan" />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 md:items-center">
          <MapPanel bounds={bounds} basemap={basemap} strikes={strikes} image={images?.removed || null} ground="overlay" label="Smoke the plan removes" />
          <div className="space-y-4">
            <div>
              <div className="mb-1 text-caption text-ink-tertiary">Above, 24-hour PM2.5 as the air index</div>
              <ApiLegend />
            </div>
            {images ? (
              <div>
                <div className="mb-1 text-caption text-ink-tertiary">Left, without minus with</div>
                {images.max > 0 ? <RemovedLegend max={images.max} /> : <p className="text-caption text-ink-tertiary">Under 1 ug/m3 anywhere</p>}
              </div>
            ) : null}
            <div className="text-caption text-ink-tertiary">{malaysiaWhen(maps.at)}, when the plan helps most</div>
          </div>
        </div>
        <p className="mt-2 text-caption text-ink-tertiary">{maps.note}</p>
      </div>
    );
  }

  const fallback = basemap ? placeNamed(basemap, "Kuala Lumpur") : null;
  const points = [...strikes, ...(fallback ? [fallback] : [])];
  if (points.length === 0) return <p className="text-small text-ink-tertiary">No complex to show on the map.</p>;
  return (
    <div>
      <div className="max-w-[640px]">
        <MapPanel bounds={fitBounds(points, 1.6)} basemap={basemap} strikes={strikes} image={null} ground="plain" label="KL and the complexes the plan strikes" />
      </div>
      <p className="mt-1.5 text-caption text-ink-tertiary">Numbered in the order the plan attacks them.</p>
    </div>
  );
}
