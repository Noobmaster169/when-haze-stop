"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { HazeMap } from "@/lib/api/haze-schemas";
import { parsedFetcher } from "@/lib/poll";

import { type Basemap, loadBasemap } from "./basemap";
import { type MapData, unpackMap } from "./map-data";

/**
 * The map's data, kept fresh. The backend's job runs once an hour, so asking
 * every five minutes picks a new run up soon after it lands without the
 * person doing anything.
 */

const fetcher = parsedFetcher(HazeMap);
const REFRESH_MS = 5 * 60_000;

export interface HazeMapState {
  map: HazeMap | undefined;
  data: MapData | null;
  basemap: Basemap | null;
  error: string | null;
}

export function useHazeMap(): HazeMapState {
  const { data: map, error } = useSWR("/api/haze/map", fetcher, { refreshInterval: REFRESH_MS, revalidateOnFocus: false });
  const data = useMemo(() => (map ? unpackMap(map) : null), [map]);
  const [basemap, setBasemap] = useState<Basemap | null>(null);

  useEffect(() => {
    let live = true;
    const load = async (): Promise<void> => {
      try {
        const loaded = await loadBasemap("/basemap.json");
        if (live) setBasemap(loaded);
      } catch (caught) {
        // The haze still draws without coastlines; the console says why they are missing.
        console.error(caught);
      }
    };
    void load();
    return () => {
      live = false;
    };
  }, []);

  return { map, data, basemap, error: error instanceof Error ? error.message : null };
}
