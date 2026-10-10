"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/icons";
import { type Place, PlaceList } from "@/lib/api/haze-schemas";

/** Find a place by name. Each result says which DOE station speaks for it, because that is whose readings will be shown. */

const WAIT_MS = 280;

export function PlaceSearch({ onChoose }: { onChoose(place: Place): void }) {
  const [text, setText] = useState("");
  const [found, setFound] = useState<Place[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const query = text.trim();

  useEffect(() => {
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/haze/places?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const parsed = PlaceList.safeParse(await response.json());
        setFailed(!response.ok || !parsed.success);
        setFound(parsed.success ? parsed.data.places : []);
      } catch {
        // A newer keystroke aborted this one and its own search will answer. Anything else is the search not working.
        if (controller.signal.aborted) return;
        setFailed(true);
        setFound([]);
      }
    }, WAIT_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const results = query.length < 2 ? null : found;
  const choose = (place: Place): void => {
    setText(place.name);
    setOpen(false);
    onChoose(place);
  };

  return (
    <div className="relative w-[min(300px,calc(100vw-5.5rem))]">
      <label className="flex h-9 items-center gap-2 rounded-lg border border-hairline bg-canvas px-3 shadow-overlay">
        <Icon name="search" size={14} className="shrink-0 text-ink-tertiary" />
        <input
          type="search"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results?.[0]) choose(results[0]);
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder="Search a town or district"
          aria-label="Search a place"
          className="min-w-0 grow bg-transparent text-strong text-ink outline-none placeholder:text-ink-faint focus-visible:shadow-none"
        />
      </label>

      {open && results ? (
        <ul className="absolute inset-x-0 top-10 z-10 max-h-[320px] overflow-y-auto rounded-lg border border-hairline bg-canvas py-1 shadow-overlay">
          {results.length === 0 ? <li className="px-3 py-2 text-small text-ink-tertiary">{failed ? "Search is not answering right now." : "No place by that name in this region."}</li> : null}
          {results.map((place) => (
            <li key={`${place.name}-${place.lat}-${place.lon}`}>
              <button type="button" onClick={() => choose(place)} className="block w-full px-3 py-1.5 text-left hover:bg-active">
                <span className="block text-strong text-ink">
                  {place.name}
                  <span className="text-ink-tertiary">, {place.region || place.country}</span>
                </span>
                {place.nearest && place.nearest.km > 0 ? (
                  <span className="block text-caption text-ink-tertiary">
                    Nearest station: {place.nearest.name}, {place.nearest.km} km
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
