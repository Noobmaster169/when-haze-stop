"use client";

import { useCallback, useState } from "react";

import { utcDay } from "./fires";
import type { MapData } from "./map-data";
import { atEdge, type TimeWindow, windowAround } from "./time-window";

/**
 * The moment the map is on, and whether it is the live map or looking back.
 * Live, the timeline spans the week of readings and the forecast. Looking back
 * it spans a week of the past, and that week moves when the timeline is let go
 * at an end of it or played through it, so one drag after another reaches any
 * stored day. The day drawn is the one the moment falls in.
 */

const DAY_MS = 86_400_000;
const NOON_MS = DAY_MS / 2;

export interface TimeTravel {
  at: number;
  /** The week the timeline spans while looking back, or null on the live map. */
  past: TimeWindow | null;
  /** The UTC day being looked back at, or null on the live map. */
  day: string | null;
  playing: boolean;
  setPlaying(playing: boolean): void;
  seek(moment: number): void;
  /** The timeline was let go at a moment: at an end of its span, the span moves on. */
  release(moment: number): void;
  /** A day picked from the History strip, or null for the live map. */
  chooseDay(day: string | null): void;
}

export function useTimeTravel(live: MapData | null, firstDay: string | undefined): TimeTravel {
  const [chosenAt, setChosenAt] = useState<number | null>(null);
  const [past, setPast] = useState<TimeWindow | null>(null);
  const [playing, setPlaying] = useState(false);

  const newest = live?.asOf ?? 0;
  const liveFrom = live?.times[0] ?? 0;
  const first = firstDay ? Date.parse(`${firstDay}T00:00:00Z`) : 0;
  // Until the timeline is touched it sits on the newest readings, and moves with them when a new run lands.
  const at = chosenAt ?? newest;

  const goLive = useCallback(() => {
    setPast(null);
    setChosenAt(null);
    setPlaying(false);
  }, []);

  const seek = useCallback(
    (moment: number) => {
      if (!past) {
        setChosenAt(moment === newest ? null : moment);
        return;
      }
      setChosenAt(moment);
      if (!playing || moment < past.to) return;
      // Playing runs on into the next week, and stops at the newest reading, where there is no more past.
      if (moment >= newest) setPlaying(false);
      else setPast(windowAround(moment, first, newest));
    },
    [past, playing, first, newest],
  );

  const release = useCallback(
    (moment: number) => {
      if (!past) {
        if (moment <= liveFrom) setPast(windowAround(moment, first, newest));
        return;
      }
      if (!atEdge(moment, past)) return;
      if (moment >= newest) goLive();
      else setPast(windowAround(moment, first, newest));
    },
    [past, liveFrom, first, newest, goLive],
  );

  const chooseDay = useCallback(
    (day: string | null) => {
      if (!day) {
        goLive();
        return;
      }
      // Stepping from day to day keeps the hour, so the same time of day is compared.
      const hour = past ? ((at % DAY_MS) + DAY_MS) % DAY_MS : NOON_MS;
      const moment = Math.min(Date.parse(`${day}T00:00:00Z`) + hour, newest);
      setPlaying(false);
      setChosenAt(moment);
      setPast(past && moment >= past.from && moment <= past.to ? past : windowAround(moment, first, newest));
    },
    [past, at, first, newest, goLive],
  );

  return { at, past, day: past ? utcDay(at) : null, playing, setPlaying, seek, release, chooseDay };
}
