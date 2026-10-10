import type { Basemap } from "@/components/map/basemap";
import type { StrikeLine } from "@/lib/api/council-schemas";

import { type Bounds, coastPaths, fanOut, placeNamed, project } from "./map-geometry";

/**
 * One map of the target region: the ground, an optional picture over it (the
 * engine's field, or what the plan removes), the coasts, KL, and the struck
 * complexes numbered in the order they are attacked. Markers that would sit on
 * each other fan out, with a short leader back to where each belongs.
 */

const WIDTH = 600;
/** Closest two markers may sit, in the map's own units: a little more than one marker across. */
const MARKER_GAP = 26;

export type Ground = "field" | "overlay" | "plain";

export function MapPanel({ bounds, basemap, strikes, image, ground, label }: { bounds: Bounds; basemap: Basemap | null; strikes: StrikeLine[]; image: string | null; ground: Ground; label: string }) {
  const view = project(bounds, WIDTH);
  const coasts = basemap ? coastPaths(basemap, view) : null;
  const kl = basemap ? placeNamed(basemap, "Kuala Lumpur") : null;
  const id = `clip-${label.replace(/\W+/g, "-")}`;
  const markers = fanOut(
    strikes.map((line) => ({ x: view.x(line.lon), y: view.y(line.lat) })),
    MARKER_GAP,
  );
  // Over the engine's field the map's dark coasts read; on the plain ground they vanish in the dark scheme, so they take an ink line there.
  const field = ground === "field" && image !== null;
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1.5 text-small font-medium text-ink">{label}</figcaption>
      <svg viewBox={`0 0 ${view.width} ${view.height}`} className="block w-full overflow-hidden rounded-lg border border-hairline" role="img" aria-label={label}>
        <clipPath id={id}>
          <rect width={view.width} height={view.height} />
        </clipPath>
        <g clipPath={`url(#${id})`}>
          <rect width={view.width} height={view.height} fill="var(--map-sea)" />
          {coasts && !field ? <path d={coasts.land} fill="var(--map-land)" /> : null}
          {image ? <image href={image} x={0} y={0} width={view.width} height={view.height} preserveAspectRatio="none" /> : null}
          {coasts ? <path d={coasts.land} fill="none" stroke={field ? "var(--map-coast)" : "var(--ink-faint)"} strokeWidth={0.9} /> : null}
          {coasts ? <path d={coasts.borders} fill="none" stroke={field ? "var(--map-border)" : "var(--ink-faint)"} strokeWidth={0.7} strokeDasharray="3 2" /> : null}
          {kl ? (
            <g transform={`translate(${view.x(kl.lon)} ${view.y(kl.lat)})`}>
              <rect x={-4} y={-4} width={8} height={8} transform="rotate(45)" fill="var(--canvas)" stroke="var(--ink)" strokeWidth={1.5} />
              <text x={9} y={4} fontSize={13} fontWeight={600} fill="var(--map-label)" stroke="var(--canvas)" strokeWidth={3} paintOrder="stroke">
                KL
              </text>
            </g>
          ) : null}
          {strikes.map((line, index) => {
            const marker = markers[index];
            const moved = Math.hypot(marker.x - marker.atX, marker.y - marker.atY) > 1;
            return (
              <g key={line.complexId}>
                {moved ? (
                  <>
                    <line x1={marker.atX} y1={marker.atY} x2={marker.x} y2={marker.y} stroke="var(--ink)" strokeWidth={1.25} />
                    <circle cx={marker.atX} cy={marker.atY} r={2.5} fill="var(--ink)" stroke="var(--canvas)" strokeWidth={1} />
                  </>
                ) : null}
                <g transform={`translate(${marker.x.toFixed(1)} ${marker.y.toFixed(1)})`}>
                  <circle r={11} fill="var(--ink)" stroke="var(--canvas)" strokeWidth={2} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={12.5} fontWeight={700} fill="var(--ink-inverse)">
                    {line.order}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>
    </figure>
  );
}
