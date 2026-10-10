"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import { Timeline } from "@/components/map/timeline";
import { CityAir } from "@/lib/api/city-schemas";
import { parsedFetcher } from "@/lib/poll";

import { airAt, middayOf } from "./air-at";
import { fetchCityData } from "./city-data";
import { CityPanel } from "./city-panel";
import { createCityScene, type CityScene } from "./city-scene";
import { readCityTheme, type CityTheme } from "./city-theme";
import { VIEW_KEYS, VIEWS, type ViewKey } from "./city-views";
import { lookFor } from "./haze-look";
import { sunPosition } from "./sun";

/**
 * Kuala Lumpur in 3D under the haze of any hour in the stored week and the
 * forecast after it. The scene is drawn once; the timeline only changes the
 * light and the air in it.
 */

const fetcher = parsedFetcher(CityAir);
const KEY = "kl";

export function CityView() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<{ handle: CityScene; theme: CityTheme } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState<ViewKey>("skyline");
  const [midday, setMidday] = useState(false);

  const { data: model } = useSWR(`city:${KEY}`, () => fetchCityData(KEY), { revalidateOnFocus: false, onError: (error: Error) => setFailure(error.message) });
  const { data: city, error } = useSWR(`/api/haze/cities/${KEY}`, fetcher, { refreshInterval: 300_000 });

  useEffect(() => {
    const element = canvas.current;
    if (!element || !model) return;
    const theme = readCityTheme(element);
    const handle = createCityScene(element, model, theme);
    setScene({ handle, theme });
    return () => {
      handle.dispose();
      setScene(null);
    };
  }, [model]);

  useEffect(() => {
    scene?.handle.setView(view);
  }, [scene, view]);

  const times = useMemo(() => (city ? city.hours.map((hour) => Date.parse(hour.at)) : []), [city]);
  const now = city?.asOf ? Date.parse(city.asOf) : (times[times.length - 1] ?? 0);
  const at = picked ?? now;
  const air = useMemo(() => (city ? airAt(city.hours, at) : null), [city, at]);

  useEffect(() => {
    if (!scene || !air || !city) return;
    const sun = sunPosition(midday ? middayOf(at) : at, city.city.lat, city.city.lon);
    scene.handle.setLook(lookFor(air, sun, scene.theme.palette), sun);
  }, [scene, air, at, midday, city]);

  const seek = useCallback((moment: number) => setPicked(moment), []);

  if (error || failure) {
    return (
      <div className="flex grow items-center justify-center p-8 text-center">
        <p className="max-w-[48ch] text-body text-ink-secondary">{failure ?? "The haze for Kuala Lumpur could not be loaded. The backend may be down."}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 grow flex-col">
      <div className="@container relative min-h-[320px] grow overflow-hidden bg-sunken">
        <canvas ref={canvas} className="block h-full w-full touch-none" aria-label="A 3D model of central Kuala Lumpur under the haze of the chosen hour" />
        {!scene ? <p className="absolute inset-x-0 top-1/2 text-center text-small text-ink-tertiary">Building the city</p> : null}
        {air && city ? (
          <div className="absolute left-3 top-16 @[900px]:top-3">
            <CityPanel air={air} city={city} />
          </div>
        ) : null}
        <div className="absolute bottom-8 left-3 flex flex-col items-start gap-2 sm:bottom-auto sm:left-auto sm:right-3 sm:top-16 sm:items-end">
          <div role="group" aria-label="Where to stand" className="flex rounded-full bg-ink p-1 shadow-overlay">
            {VIEW_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={`h-8 rounded-full px-3 text-small font-medium transition-colors duration-200 ${view === key ? "bg-ink-inverse/15 text-ink-inverse" : "text-ink-inverse/60 hover:text-ink-inverse"}`}
              >
                {VIEWS[key].label}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-hairline bg-canvas/92 px-3 py-1.5 text-small text-ink-secondary shadow-overlay backdrop-blur">
            <input type="checkbox" checked={midday} onChange={(event) => setMidday(event.target.checked)} className="accent-[var(--accent)]" />
            Light it at midday
          </label>
        </div>
        <p className="absolute bottom-2 right-3 hidden text-micro text-ink-tertiary sm:block">Drag to look around{view === "skyline" ? ", scroll to zoom" : ""}</p>
      </div>
      {city && times.length > 1 ? <Timeline from={times[0]} to={times[times.length - 1]} now={now} at={at} playing={playing} onSeek={seek} onPlaying={setPlaying} /> : null}
    </div>
  );
}
