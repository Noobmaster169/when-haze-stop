"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

import { type FireDay, HazeDay, HazeDays } from "@/lib/api/haze-schemas";
import { parsedFetcher } from "@/lib/poll";

import { type MapData, unpackDay } from "./map-data";

/**
 * Looking back: the days that are stored, and the one chosen, unpacked for the
 * map. A past day never changes, so it is fetched once and kept.
 */

const daysFetcher = parsedFetcher(HazeDays);
const dayFetcher = parsedFetcher(HazeDay);
const REFRESH_MS = 5 * 60_000;

export interface HazeDayState {
  days: FireDay[];
  /** The chosen UTC day, or null while the map is live. */
  day: string | null;
  /** Null until the chosen day has loaded. */
  data: MapData | null;
  choose(day: string | null): void;
}

export function useHazeDay(): HazeDayState {
  const [day, setDay] = useState<string | null>(null);
  const { data: stored } = useSWR("/api/haze/days", daysFetcher, { refreshInterval: REFRESH_MS, revalidateOnFocus: false });
  const { data: loaded } = useSWR(day ? `/api/haze/days/${day}` : null, dayFetcher, { revalidateOnFocus: false });
  const data = useMemo(() => (loaded && loaded.day === day ? unpackDay(loaded) : null), [loaded, day]);
  return useMemo(() => ({ days: stored?.days ?? [], day, data, choose: setDay }), [stored, day, data]);
}
