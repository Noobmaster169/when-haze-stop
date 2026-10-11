"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Place } from "@/lib/api/haze-schemas";

import { ForecastCaption } from "./forecast-caption";
import { REGION } from "./geo";
import { HistoryStrip } from "./history-strip";
import { LocateCard } from "./locate-card";
import { type Layers, MapCanvas, type MapHandle, type Pick } from "./map-canvas";
import { Legend, LayerToggles, ZoomButtons } from "./map-controls";
import { apiAt } from "./map-data";
import { MonitorPanel } from "./monitor-panel";
import { Notice } from "./notice";
import { PlaceSearch } from "./place-search";
import { PointPanel } from "./point-panel";
import { nearestStation, type Probe, ProbeTip } from "./probe-tip";
import { StationPanel } from "./station-panel";
import { Timeline } from "./timeline";
import { useHazeDay, useStoredDays } from "./use-haze-day";
import { useHazeMap } from "./use-haze-map";
import { useTimeTravel } from "./use-time-travel";
import { saveLocation, useMyLocation } from "./my-location";

/**
 * The map page: the map, what is laid over it, the timeline under it and the
 * station beside it. It holds what the parts share: the station chosen and
 * the layers shown. The moment the timeline is on comes from `useTimeTravel`.
 */

const ALL_LAYERS: Layers = { haze: true, stations: true, fires: true, wind: true, visibility: true };

/** Keyed by the page on `initialStation`, so a link to another station starts it on that one. */
export function HazeMapView({ initialStation }: { initialStation: string | null }) {
  const { map, data: liveData, basemap, error } = useHazeMap();
  const days = useStoredDays();
  const { at, past, day, playing, setPlaying, seek, release, chooseDay: travelTo } = useTimeTravel(liveData, days[0]?.day);
  const dayData = useHazeDay(day);
  // Looking back replaces what the map draws, and nothing else: the same canvas, layers and timeline.
  const data = day ? dayData : liveData;
  const handle = useRef<MapHandle | null>(null);
  const tip = useRef<HTMLDivElement | null>(null);
  const [layers, setLayers] = useState(ALL_LAYERS);
  const [selected, setSelected] = useState<{ id: string; via: string | null } | null>(initialStation ? { id: initialStation, via: null } : null);
  const [monitorId, setMonitorId] = useState<string | null>(null);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [preview, setPreview] = useState<Place | null>(null);

  const station = data?.stations.find((item) => item.id === selected?.id) ?? null;
  // An instrument of a past day. The same sensor on another day keeps its panel; a day it did not report closes it.
  const monitor = data?.monitors.find((item) => item.id === monitorId) ?? null;

  const flown = useRef<string | null>(null);
  useEffect(() => {
    if (!initialStation || !data || flown.current === initialStation) return;
    const target = data.stations.find((item) => item.id === initialStation);
    if (!target) return;
    flown.current = initialStation;
    handle.current?.flyTo(target.lon, target.lat);
  }, [initialStation, data]);

  const nearestTo = useCallback((lon: number, lat: number) => nearestStation(data?.stations ?? [], lon, lat), [data]);

  const chooseDay = useCallback(
    (chosen: string | null) => {
      travelTo(chosen);
      setProbe(null);
    },
    [travelTo],
  );

  const hasField = (data?.fields.length ?? 0) > 0;
  const pick = useCallback(
    (picked: Pick) => {
      handle.current?.reveal(picked.lon, picked.lat);
      setMonitorId(picked.monitor?.id ?? null);
      if (picked.monitor) {
        setSelected(null);
        setProbe(null);
        return;
      }
      if (picked.station) {
        setSelected({ id: picked.station.id, via: null });
        setProbe(null);
        return;
      }
      // A day from before the first readings has no field, so a spot on it has nothing to show.
      if (!hasField) return;
      setSelected(null);
      setProbe({ lon: picked.lon, lat: picked.lat, name: null, nearest: nearestTo(picked.lon, picked.lat) });
    },
    [nearestTo, hasField],
  );

  const location = useMyLocation();
  /** Your own spot opens like any other, named as yours, with its nearest station one tap away. */
  const goHome = useCallback(
    (lat: number, lon: number) => {
      const inside = lon >= REGION.lon0 && lon <= REGION.lon1 && lat >= REGION.lat0 && lat <= REGION.lat1;
      const nearest = inside ? nearestTo(lon, lat) : null;
      saveLocation({ lat, lon, nearest });
      if (!inside) return;
      handle.current?.flyTo(lon, lat);
      setSelected(null);
      setProbe({ lon, lat, name: "Your location", nearest });
    },
    [nearestTo],
  );
  const homed = useRef(false);
  useEffect(() => {
    if (homed.current || initialStation || !data || !location || location === "declined") return;
    homed.current = true;
    goHome(location.lat, location.lon);
  }, [data, location, initialStation, goHome]);

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
  if (map && !liveData) {
    return <Notice title="No forecast has been made yet." body="Start the data job in backend/ with pnpm haze:once. It fetches the readings, fires and wind, then runs the model." />;
  }

  return (
    <div className="flex min-h-0 grow flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      <div className="flex min-w-0 shrink-0 grow flex-col lg:min-h-0 lg:shrink">
        <div className="@container relative h-[54dvh] min-h-[300px] shrink-0 lg:h-auto lg:shrink lg:grow">
          <MapCanvas handle={handle} data={data} basemap={basemap} at={at} layers={layers} selectedId={monitor?.id ?? station?.id ?? null} pin={probe} preview={preview && (preview.lon !== probe?.lon || preview.lat !== probe?.lat) ? preview : null} onPick={pick} onPaint={followTip} />
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
            <Legend past={day !== null} />
          </div>
          {probe && data && hasField ? <ProbeTip anchor={tip} api={apiAt(data, at, probe.lon, probe.lat)} at={at} /> : null}
          {data && location === null ? (
            <div className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
              <LocateCard onLocated={goHome} onDecline={() => saveLocation("declined")} />
            </div>
          ) : null}
          {!data ? <p className="absolute inset-x-0 top-1/2 text-center text-small text-ink-tertiary">Loading the map</p> : null}
          {station ? <StationPanel key={station.id} station={station} at={at} via={selected?.via ?? null} onClose={() => setSelected(null)} /> : null}
          {monitor && data?.dayStart != null ? <MonitorPanel monitor={monitor} dayStart={data.dayStart} at={at} onClose={() => setMonitorId(null)} /> : null}
          {!station && !monitor && probe && data && hasField ? <PointPanel data={data} basemap={basemap} probe={probe} at={at} onStation={openStation} onClose={() => setProbe(null)} /> : null}
        </div>
        {data ? <ForecastCaption data={data} at={at} /> : null}
        <HistoryStrip days={days} day={day} onChoose={chooseDay} />
        {past && liveData ? (
          <Timeline from={past.from} to={past.to} now={liveData.asOf} at={at} playing={playing} caption={hasField ? "Past day" : "Past day, as measured"} rolls onSeek={seek} onRelease={release} onPlaying={setPlaying} />
        ) : liveData ? (
          <Timeline from={liveData.times[0]} to={liveData.times[liveData.times.length - 1]} now={liveData.asOf} at={at} playing={playing} onSeek={seek} onRelease={release} onPlaying={setPlaying} />
        ) : null}
      </div>
    </div>
  );
}
