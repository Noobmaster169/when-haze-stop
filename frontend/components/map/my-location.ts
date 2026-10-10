"use client";

import { useSyncExternalStore } from "react";

import type { Network } from "@/lib/api/haze-schemas";

/**
 * Where the person said they are, kept in this browser only. The map asks
 * once, on the first visit, and flies there; the alerts page offers the
 * nearest station. Nothing here is sent anywhere.
 */

export interface MyLocation {
  lat: number;
  lon: number;
  /** `network` is absent on a place saved before Singapore's regions were stations. */
  nearest: { id: string; name: string; network?: Network; km: number } | null;
}

/** `null`: not asked yet. `"declined"`: "Not now". Otherwise the place. */
export type LocationAnswer = MyLocation | "declined" | null;

const KEY = "haze.location";
const listeners = new Set<() => void>();
let cached: { raw: string | null; answer: LocationAnswer } = { raw: null, answer: null };

function read(): LocationAnswer {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    // Storage refused: ask again next visit.
  }
  if (raw === cached.raw) return cached.answer;
  let answer: LocationAnswer = null;
  if (raw === "declined") answer = "declined";
  else if (raw) {
    try {
      const parsed = JSON.parse(raw) as MyLocation;
      answer = typeof parsed.lat === "number" && typeof parsed.lon === "number" ? parsed : null;
    } catch {
      answer = null;
    }
  }
  cached = { raw, answer };
  return answer;
}

export function saveLocation(answer: MyLocation | "declined"): void {
  try {
    window.localStorage.setItem(KEY, answer === "declined" ? answer : JSON.stringify(answer));
  } catch {
    // Kept for this visit only.
    cached = { raw: null, answer };
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Undefined on the server and during hydration, so nothing is asked before the page is live. */
export function useMyLocation(): LocationAnswer | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}

/** The browser's own prompt, as a promise. */
export function askPosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("This browser cannot share a location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
      (error) => reject(new Error(error.code === error.PERMISSION_DENIED ? "Location was not allowed." : "Your location could not be found.")),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 600_000 },
    );
  });
}
