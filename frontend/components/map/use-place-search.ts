"use client";

import { useEffect, useRef, useState } from "react";

import { type Place, PlaceList } from "@/lib/api/haze-schemas";

/**
 * Search as it is typed. Stations and the bundled gazetteer answer in tens of
 * milliseconds; when they find little, the geocoder is asked as well, which
 * takes seconds, and its places are added when they come. Every answer is
 * kept, so typing back over a word is instant, and while a new answer is on
 * its way the last one stays up, narrowed to what still matches.
 */

const LOCAL_WAIT_MS = 90;
const REMOTE_WAIT_MS = 450;
/** Fewer local matches than this and the geocoder is asked too. */
const ENOUGH = 4;

export type SearchState = "idle" | "searching" | "searching-more" | "done" | "failed";

function simple(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

async function ask(query: string, remote: boolean, signal: AbortSignal): Promise<Place[]> {
  const response = await fetch(`/api/haze/places?q=${encodeURIComponent(query)}${remote ? "&remote=1" : ""}`, { signal });
  const parsed = PlaceList.safeParse(await response.json());
  if (!response.ok || !parsed.success) throw new Error(`place search answered ${response.status}`);
  return parsed.data.places;
}

export function usePlaceSearch(query: string): { places: Place[]; state: SearchState } {
  const cache = useRef(new Map<string, Place[]>());
  const shown = useRef<Place[]>([]);
  const [result, setResult] = useState<{ query: string; places: Place[]; state: SearchState }>({ query: "", places: [], state: "idle" });
  const wanted = query.trim();

  useEffect(() => {
    if (wanted.length < 2) return;
    const key = simple(wanted);
    const controller = new AbortController();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const show = (places: Place[], state: SearchState): void => {
      shown.current = places;
      setResult({ query: wanted, places, state });
    };

    const remote = (): void => {
      const cached = cache.current.get(`r:${key}`);
      if (cached) return show(cached, "done");
      show(shown.current, "searching-more");
      timers.push(
        setTimeout(async () => {
          try {
            const places = await ask(wanted, true, controller.signal);
            cache.current.set(`r:${key}`, places);
            show(places, "done");
          } catch (error) {
            // A newer keystroke aborted this one; its own search answers. Otherwise keep what memory found.
            if (controller.signal.aborted) return;
            console.warn("[search] the geocoder did not answer:", error);
            show(shown.current, "done");
          }
        }, REMOTE_WAIT_MS),
      );
    };

    const local = cache.current.get(`l:${key}`);
    if (local) {
      show(local, "done");
      if (local.length < ENOUGH && key.length >= 3) remote();
    } else {
      // Optimistic: the last answer, narrowed to names that still match, until the new one lands.
      show(shown.current.filter((place) => simple(place.name).includes(key)), "searching");
      timers.push(
      setTimeout(async () => {
        try {
          const places = await ask(wanted, false, controller.signal);
          cache.current.set(`l:${key}`, places);
          if (places.length < ENOUGH && key.length >= 3) {
            show(places, "searching-more");
            remote();
          } else show(places, "done");
        } catch (error) {
          if (controller.signal.aborted) return;
          console.warn("[search] place search failed:", error);
          show([], "failed");
        }
      }, LOCAL_WAIT_MS),
      );
    }
    return () => {
      controller.abort();
      for (const timer of timers) clearTimeout(timer);
    };
  }, [wanted]);

  if (wanted.length < 2) return { places: [], state: "idle" };
  return { places: result.places, state: result.query === wanted ? result.state : "searching" };
}
