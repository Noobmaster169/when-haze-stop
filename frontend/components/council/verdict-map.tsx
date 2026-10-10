"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { type Basemap, loadBasemap } from "@/components/map/basemap";
import { STOP_VALUES } from "@/components/map/scale";
import { readTheme } from "@/components/map/theme";
import type { StrikeLine, Verdict } from "@/lib/api/council-schemas";
import { malaysiaWhen } from "@/lib/malaysia-time";

import { type Bounds, coastPaths, fieldImage, fitBounds, gridBounds, placeNamed, project, strikePoints } from "./map-geometry";
import { decodeBytes } from "./pm25";

/**
 * Before and after: the engine's 24-hour PM2.5 over the region at the hour the
 * plan helps most, without the plan and with it, on the map's own index
 * colours, with the struck complexes numbered in the order they are attacked.
 * A verdict without maps gets the outline and the strikes alone.
 */

const WIDTH = 600;

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

function Panel({ bounds, basemap, strikes, image, label }: { bounds: Bounds; basemap: Basemap | null; strikes: StrikeLine[]; image: string | null; label: string }) {
  const view = project(bounds, WIDTH);
  const coasts = basemap ? coastPaths(basemap, view) : null;
  const kl = basemap ? placeNamed(basemap, "Kuala Lumpur") : null;
  const id = `clip-${label.replace(/\W+/g, "-")}`;
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1.5 text-small font-medium text-ink">{label}</figcaption>
      <svg viewBox={`0 0 ${view.width} ${view.height}`} className="block w-full overflow-hidden rounded-lg border border-hairline" role="img" aria-label={label}>
        <clipPath id={id}>
          <rect width={view.width} height={view.height} />
        </clipPath>
        <g clipPath={`url(#${id})`}>
          <rect width={view.width} height={view.height} fill="var(--map-sea)" />
          {coasts && !image ? <path d={coasts.land} fill="var(--map-land)" /> : null}
          {image ? <image href={image} x={0} y={0} width={view.width} height={view.height} preserveAspectRatio="none" /> : null}
          {/* Over the field the map's dark coasts read; on the plain ground they vanish in the dark scheme, so they take an ink line there. */}
          {coasts ? <path d={coasts.land} fill="none" stroke={image ? "var(--map-coast)" : "var(--ink-faint)"} strokeWidth={0.9} /> : null}
          {coasts ? <path d={coasts.borders} fill="none" stroke={image ? "var(--map-border)" : "var(--ink-faint)"} strokeWidth={0.7} strokeDasharray="3 2" /> : null}
          {kl ? (
            <g transform={`translate(${view.x(kl.lon)} ${view.y(kl.lat)})`}>
              <rect x={-4} y={-4} width={8} height={8} transform="rotate(45)" fill="var(--canvas)" stroke="var(--ink)" strokeWidth={1.5} />
              <text x={9} y={4} fontSize={13} fontWeight={600} fill="var(--map-label)" stroke="var(--canvas)" strokeWidth={3} paintOrder="stroke">
                KL
              </text>
            </g>
          ) : null}
          {strikes.map((line) => (
            <g key={line.complexId} transform={`translate(${view.x(line.lon)} ${view.y(line.lat)})`}>
              <circle r={11} fill="var(--ink)" stroke="var(--canvas)" strokeWidth={2} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={12.5} fontWeight={700} fill="var(--ink-inverse)">
                {line.order}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </figure>
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
    const stops = readTheme(document.documentElement).stops;
    return { before: fieldImage(decodeBytes(maps.before), maps.grid, stops), after: fieldImage(decodeBytes(maps.after), maps.grid, stops), theme };
  }, [maps, theme]);

  if (maps) {
    const bounds = gridBounds(maps.grid);
    return (
      <div>
        <div className="grid gap-4 md:grid-cols-2">
          <Panel bounds={bounds} basemap={basemap} strikes={strikes} image={images?.before ?? null} label="Without the plan" />
          <Panel bounds={bounds} basemap={basemap} strikes={strikes} image={images?.after ?? null} label="With the plan" />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <ApiLegend />
          <span className="text-caption text-ink-tertiary">24-hour PM2.5 as the index, {malaysiaWhen(maps.at)} MYT, the hour the plan helps most.</span>
        </div>
        <p className="mt-1.5 text-caption text-ink-tertiary">{maps.note}</p>
      </div>
    );
  }

  const fallback = basemap ? placeNamed(basemap, "Kuala Lumpur") : null;
  const points = [...strikes, ...(fallback ? [fallback] : [])];
  if (points.length === 0) return <p className="text-small text-ink-tertiary">No complex to show on the map.</p>;
  return (
    <div>
      <div className="max-w-[640px]">
        <Panel bounds={fitBounds(points, 1.6)} basemap={basemap} strikes={strikes} image={null} label="KL and the complexes the plan strikes" />
      </div>
      <p className="mt-1.5 text-caption text-ink-tertiary">Numbered in the order the plan attacks them. The engine&apos;s before and after field is not in this run&apos;s verdict.</p>
    </div>
  );
}
