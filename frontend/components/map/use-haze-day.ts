"use client";

import { useMemo } from "react";
import useSWR from "swr";

import { HazeDay, HazeDays, type StoredDay } from "@/lib/api/haze-schemas";
import { parsedFetcher } from "@/lib/poll";

import { type MapData, unpackDay } from "./map-data";

/**
 * Looking back: the days that are stored, and one of them unpacked for the
 * map. A past day never changes, so it is fetched once and kept.
 */

const daysFetcher = parsedFetcher(HazeDays);
const dayFetcher = parsedFetcher(HazeDay);
const REFRESH_MS = 5 * 60_000;
const DAY_MS = 86_400_000;

const DAY_OPTIONS = { revalidateOnFocus: false, keepPreviousData: true };

/** Where a day, or the one so many days from it, is fetched. Null with no day, and for a day that has not come. */
function keyOf(day: string | null, shift = 0): string | null {
  if (!day) return null;
  const start = Date.parse(`${day}T00:00:00Z`) + shift * DAY_MS;
  return start > Date.now() ? null : `/api/haze/days/${new Date(start).toISOString().slice(0, 10)}`;
}

export function useStoredDays(): StoredDay[] {
  const { data } = useSWR("/api/haze/days", daysFetcher, { refreshInterval: REFRESH_MS, revalidateOnFocus: false });
  return data?.days ?? [];
}

/**
 * The day's data, or null on the live map and until the first day has loaded.
 * While the timeline crosses into another day the last one stays on the map
 * until the new one arrives, and the days either side are fetched ahead.
 */
export function useHazeDay(day: string | null): MapData | null {
  const { data: loaded } = useSWR(keyOf(day), dayFetcher, DAY_OPTIONS);
  useSWR(keyOf(day, -1), dayFetcher, DAY_OPTIONS);
  useSWR(keyOf(day, 1), dayFetcher, DAY_OPTIONS);
  return useMemo(() => (day && loaded ? unpackDay(loaded) : null), [day, loaded]);
}
