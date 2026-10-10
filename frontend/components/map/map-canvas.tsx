"use client";

import { type RefObject, useCallback, useEffect, useImperativeHandle, useRef } from "react";

import type { Station } from "@/lib/api/haze-schemas";

import type { Basemap } from "./basemap";
import { drawChart, drawMarks, type Scene } from "./draw";
import { homeView, type Size, toLat, toLon, toX, toY, viewOn, zoomAt } from "./geo";
import { createHeat, type Heat } from "./heat";
import { drawLabels } from "./labels";
import type { MapData } from "./map-data";
import { readTheme, type MapTheme } from "./theme";
import { type GestureTarget, useGestures } from "./use-gestures";
import { createWind, type WindLayer } from "./wind-particles";

/**
 * The map itself: three canvases stacked. The chart and the haze at the
 * bottom, the drifting wind in the middle, and the marks and names on top,
 * which is also the one that takes the pointer.
 *
 * Everything that changes sixty times a second lives in refs and is painted
 * directly; React is told nothing about a drag.
 */

export interface Layers {
  haze: boolean;
  stations: boolean;
  fires: boolean;
  wind: boolean;
  visibility: boolean;
}

export interface MapHandle {
  zoom(factor: number): void;
  flyTo(lon: number, lat: number): void;
  /** Where a point is on the canvas now, for anything laid over the map. */
  locate(lon: number, lat: number): { x: number; y: number } | null;
}

export interface Pick {
  lon: number;
  lat: number;
  station: Station | null;
}

interface Props {
  handle: RefObject<MapHandle | null>;
  data: MapData | null;
  basemap: Basemap | null;
  at: number;
  layers: Layers;
  selectedId: string | null;
  pin: { lon: number; lat: number } | null;
  onPick(pick: Pick): void;
  /** Called after every repaint, so an overlay can follow the map. */
  onPaint?(): void;
}

const PICK_RADIUS_PX = 14;
const MAX_PIXEL_RATIO = 2;

export function MapCanvas({ handle, data, basemap, at, layers, selectedId, pin, onPick, onPaint }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const chart = useRef<HTMLCanvasElement>(null);
  const wind = useRef<HTMLCanvasElement>(null);
  const marks = useRef<HTMLCanvasElement>(null);
  const target = useRef<GestureTarget>({ view: { cx: 103, cy: 2.6, scale: 40 }, size: { width: 0, height: 0 } });
  const tools = useRef<{ theme: MapTheme; heat: Heat; wind: WindLayer; font: string } | null>(null);
  const live = useRef({ data, basemap, at, layers, selectedId, pin, onPaint });

  const paint = useCallback(() => {
    const kit = tools.current;
    const base = chart.current?.getContext("2d");
    const top = marks.current?.getContext("2d");
    const { view, size } = target.current;
    if (!kit || !base || !top || size.width === 0) return;
    const now = live.current;
    const scene: Scene = { view, size, theme: kit.theme, basemap: now.basemap };
    // A day from before the first readings has fires and wind but no field to paint.
    const haze = now.data !== null && now.layers.haze && now.data.fields.length > 0;
    if (now.data && haze) kit.heat.paint(now.data, now.at);
    drawChart(base, scene, haze ? kit.heat.canvas : null);
    if (now.data) {
      const { fires, stations, visibility } = now.layers;
      drawMarks(top, scene, { data: now.data, at: now.at, fires, stations, visibility, fontFamily: kit.font, selectedId: now.selectedId, pin: now.pin });
    }
    else top.clearRect(0, 0, size.width, size.height);
    drawLabels(top, scene, kit.font);
    now.onPaint?.();
  }, []);

  const moved = useCallback(() => {
    const { size } = target.current;
    wind.current?.getContext("2d")?.clearRect(0, 0, size.width, size.height);
    tools.current?.wind.reset(target.current.view, size);
    paint();
  }, [paint]);

  const tapped = useCallback(
    (x: number, y: number) => {
      const { view, size } = target.current;
      const now = live.current;
      let station: Station | null = null;
      let nearest = PICK_RADIUS_PX;
      for (const candidate of now.layers.stations ? (now.data?.stations ?? []) : []) {
        const away = Math.hypot(toX(view, size, candidate.lon) - x, toY(view, size, candidate.lat) - y);
        if (away < nearest) [nearest, station] = [away, candidate];
      }
      onPick({ lon: station?.lon ?? toLon(view, size, x), lat: station?.lat ?? toLat(view, size, y), station });
    },
    [onPick],
  );

  useGestures(marks, target, moved, tapped);

  useImperativeHandle(handle, () => ({
    zoom(factor) {
      const { view, size } = target.current;
      target.current.view = zoomAt(view, size, size.width / 2, size.height / 2, factor);
      moved();
    },
    flyTo(lon, lat) {
      target.current.view = viewOn(target.current.size, lon, lat, target.current.view);
      moved();
    },
    locate(lon, lat) {
      const { view, size } = target.current;
      const x = toX(view, size, lon);
      const y = toY(view, size, lat);
      return x >= 0 && x <= size.width && y >= 0 && y <= size.height ? { x, y } : null;
    },
  }));

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const theme = readTheme(element);
    tools.current = { theme, heat: createHeat(theme.stops), wind: createWind(theme.wind), font: getComputedStyle(element).fontFamily };

    const resize = (): void => {
      const box = element.getBoundingClientRect();
      const size: Size = { width: Math.max(200, box.width), height: Math.max(200, box.height) };
      const ratio = Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1);
      for (const canvas of [chart.current, wind.current, marks.current]) {
        if (!canvas) continue;
        canvas.width = Math.round(size.width * ratio);
        canvas.height = Math.round(size.height * ratio);
        canvas.getContext("2d")?.setTransform(ratio, 0, 0, ratio, 0, 0);
      }
      const first = target.current.size.width === 0;
      target.current.size = size;
      if (first) target.current.view = homeView(size);
      moved();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let request = 0;
    const tick = (): void => {
      const now = live.current;
      const context = wind.current?.getContext("2d");
      const { view, size } = target.current;
      if (context && now.data && now.layers.wind && !still && !document.hidden) tools.current?.wind.step(context, view, size, now.data, now.at);
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(request);
    };
  }, [moved]);

  useEffect(() => {
    live.current = { data, basemap, at, layers, selectedId, pin, onPaint };
    paint();
  }, [paint, data, basemap, at, layers, selectedId, pin, onPaint]);

  useEffect(() => {
    if (layers.wind) return;
    const { size } = target.current;
    wind.current?.getContext("2d")?.clearRect(0, 0, size.width, size.height);
  }, [layers.wind]);

  return (
    <div ref={frame} className="absolute inset-0 overflow-hidden bg-map-sea font-sans">
      <canvas ref={chart} className="absolute inset-0 h-full w-full" />
      <canvas ref={wind} className="pointer-events-none absolute inset-0 h-full w-full" />
      <canvas
        ref={marks}
        tabIndex={0}
        aria-label="Haze map. Drag to move, scroll to zoom, select a station to read it."
        className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
      />
    </div>
  );
}
