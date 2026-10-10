"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Place } from "@/lib/api/haze-schemas";

import { distanceKm } from "./geo";
import { type Layers, MapCanvas, type MapHandle, type Pick } from "./map-canvas";
import { Legend, LayerToggles, ZoomButtons } from "./map-controls";
import { apiAt } from "./map-data";
import { PlaceSearch } from "./place-search";
import { PointPanel } from "./point-panel";
import { type Probe, ProbeTip } from "./probe-tip";
import { StationPanel } from "./station-panel";
import { Timeline } from "./timeline";
import { useHazeMap } from "./use-haze-map";

/**
 * The map page: the map, what is laid over it, the timeline under it and the
 * station beside it. It holds the three things the parts share: the moment
 * the timeline is on, the station chosen, and the layers shown.
 */

const ALL_LAYERS: Layers = { haze: true, stations: true, fires: true, wind: true };

/** Keyed by the page on `initialStation`, so a link to another station starts it on that one. */
export function HazeMapView({ initialStation }: { initialStation: string | null }) {
  const { map, data, basemap, error } = useHazeMap();
  const handle = useRef<MapHandle | null>(null);
  const tip = useRef<HTMLDivElement | null>(null);
  const [chosenAt, setChosenAt] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [layers, setLayers] = useState(ALL_LAYERS);
  const [selected, setSelected] = useState<{ id: string; via: string | null } | null>(initialStation ? { id: initialStation, via: null } : null);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [preview, setPreview] = useState<Place | null>(null);

  // Until the timeline is touched it sits on the newest readings, and moves with them when a new run lands.
  const at = chosenAt ?? data?.asOf ?? 0;
  const station = data?.stations.find((item) => item.id === selected?.id) ?? null;

  const asOf = data?.asOf;
  const seek = useCallback((moment: number) => setChosenAt(moment === asOf ? null : moment), [asOf]);

  const flown = useRef<string | null>(null);
  useEffect(() => {
    if (!initialStation || !data || flown.current === initialStation) return;
    const target = data.stations.find((item) => item.id === initialStation);
    if (!target) return;
    flown.current = initialStation;
    handle.current?.flyTo(target.lon, target.lat);
  }, [initialStation, data]);

  const nearestTo = useCallback(
    (lon: number, lat: number): Probe["nearest"] => {
      let best: Probe["nearest"] = null;
      for (const item of data?.stations ?? []) {
        const km = Math.round(distanceKm(lat, lon, item.lat, item.lon));
        if (!best || km < best.km) best = { id: item.id, name: item.name, km };
      }
      return best;
    },
    [data],
  );

  const pick = useCallback(
    (picked: Pick) => {
      handle.current?.reveal(picked.lon, picked.lat);
      if (picked.station) {
        setSelected({ id: picked.station.id, via: null });
        setProbe(null);
        return;
      }
      setSelected(null);
      setProbe({ lon: picked.lon, lat: picked.lat, name: null, nearest: nearestTo(picked.lon, picked.lat) });
    },
    [nearestTo],
  );

  /** A station opens its own panel. Anywhere else opens the spot itself, named, with its nearest station one tap away. */
  const choosePlace = useCallback((place: Place) => {
    handle.current?.flyTo(place.lon, place.lat);
    if (place.nearest && place.nearest.km === 0) {
      setSelected({ id: place.nearest.id, via: null });
      setProbe(null);
      return;
    }
    setSelected(null);
    setProbe({ lon: place.lon, lat: place.lat, name: place.name, nearest: place.nearest });
  }, []);

  const openStation = useCallback(
    (id: string) => {
      const from = probe?.name && probe.nearest ? `${probe.name}, ${probe.nearest.km} km away` : null;
      setSelected({ id, via: from });
      setProbe(null);
    },
    [probe],
  );

  const followTip = useCallback(() => {
    const element = tip.current;
    if (!element || !probe) return;
    const spot = handle.current?.locate(probe.lon, probe.lat);
    element.style.visibility = spot ? "visible" : "hidden";
    if (spot) element.style.transform = `translate(${spot.x}px, ${spot.y}px)`;
  }, [probe]);
  useEffect(followTip, [followTip]);

  if (error) return <Notice title="The map could not be loaded." body={error} />;
  if (map && !data) {
    return <Notice title="No forecast has been made yet." body="Start the data job in backend/ with pnpm haze:once. It fetches the readings, fires and wind, then runs the model." />;
  }

  return (
    <div className="flex min-h-0 grow flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      <div className="flex min-w-0 shrink-0 grow flex-col lg:min-h-0 lg:shrink">
        <div className="@container relative h-[54dvh] min-h-[300px] shrink-0 lg:h-auto lg:shrink lg:grow">
          <MapCanvas handle={handle} data={data} basemap={basemap} at={at} layers={layers} selectedId={station?.id ?? null} pin={probe} preview={preview && (preview.lon !== probe?.lon || preview.lat !== probe?.lat) ? preview : null} onPick={pick} onPaint={followTip} />
          {/* Under the island on a map too narrow to hold both side by side. */}
          <div className="absolute left-3 top-16 z-30 @[900px]:top-3">
            <PlaceSearch onChoose={choosePlace} onPreview={setPreview} />
          </div>
          {/* Below the chat's button, which floats in the corner above. */}
          <div className="absolute right-3 top-16">
            <ZoomButtons onZoom={(factor) => handle.current?.zoom(factor)} />
          </div>
          <div className="absolute bottom-3 left-3">
            <LayerToggles layers={layers} onChange={setLayers} />
          </div>
          <div className="absolute bottom-3 right-3 hidden @[640px]:block">
            <Legend />
          </div>
          {probe && data ? <ProbeTip anchor={tip} api={apiAt(data, at, probe.lon, probe.lat)} at={at} /> : null}
          {!data ? <p className="absolute inset-x-0 top-1/2 text-center text-small text-ink-tertiary">Loading the map</p> : null}
          {station ? <StationPanel key={station.id} station={station} at={at} via={selected?.via ?? null} onClose={() => setSelected(null)} /> : null}
          {!station && probe && data ? <PointPanel data={data} basemap={basemap} probe={probe} at={at} onStation={openStation} onClose={() => setProbe(null)} /> : null}
        </div>
        {data ? <Timeline from={data.times[0]} to={data.times[data.times.length - 1]} now={data.asOf} at={at} playing={playing} onSeek={seek} onPlaying={setPlaying} /> : null}
      </div>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex grow items-center justify-center px-6">
      <div className="max-w-[46ch] text-center">
        <p className="font-display text-[21px] text-ink">{title}</p>
        <p className="mt-2 text-body text-ink-secondary">{body}</p>
      </div>
    </div>
  );
}
