"use client";

import { useEffect, useId, useState } from "react";

import { Icon } from "@/components/ui/icons";
import type { Place } from "@/lib/api/haze-schemas";

import { LoadingDots } from "./loading-dots";
import { PlaceRow } from "./place-row";
import { usePlaceSearch } from "./use-place-search";

/**
 * Find a place by name, the way a map search works: results as you type, the
 * arrow keys to move through them with the map showing where each one is,
 * and Enter to go there.
 */
export function PlaceSearch({ onChoose, onPreview }: { onChoose(place: Place): void; onPreview?(place: Place | null): void }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { places, state } = usePlaceSearch(text);
  const list = useId();
  const showing = open && text.trim().length >= 2;
  const current = showing ? (places[Math.min(active, places.length - 1)] ?? null) : null;

  useEffect(() => onPreview?.(current), [current, onPreview]);

  const choose = (place: Place): void => {
    setText(place.name);
    setOpen(false);
    onChoose(place);
  };
  const move = (step: number): void => {
    if (places.length === 0) return;
    setOpen(true);
    setActive((index) => (Math.min(index, places.length - 1) + step + places.length) % places.length);
  };

  return (
    <div className="relative w-[min(340px,calc(100vw-5.5rem))]">
      <label className="flex h-10 items-center gap-2 rounded-lg border border-hairline bg-canvas px-3 shadow-overlay focus-within:border-accent-line">
        <Icon name="search" size={15} className="shrink-0 text-ink-tertiary" />
        <input
          role="combobox"
          aria-expanded={showing}
          aria-controls={list}
          aria-activedescendant={current ? `${list}-${places.indexOf(current)}` : undefined}
          aria-autocomplete="list"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") move(1);
            else if (event.key === "ArrowUp") move(-1);
            else if (event.key === "Enter" && current) choose(current);
            else if (event.key === "Escape") setOpen(false);
            else return;
            event.preventDefault();
          }}
          placeholder="Search a town or district"
          aria-label="Search a place"
          className="min-w-0 grow bg-transparent text-strong text-ink outline-none placeholder:text-ink-faint focus-visible:shadow-none"
        />
        {state === "searching" && showing ? (
          <span className="text-ink-tertiary">
            <LoadingDots label="Searching" />
          </span>
        ) : null}
        {text ? (
          <button
            type="button"
            aria-label="Clear the search"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setText("");
              setActive(0);
            }}
            className="flex size-6 shrink-0 items-center justify-center rounded-sm text-ink-tertiary hover:bg-active hover:text-ink"
          >
            <Icon name="close" size={13} />
          </button>
        ) : null}
      </label>

      {showing ? (
        <ul id={list} role="listbox" aria-label="Places" className="absolute inset-x-0 top-12 z-10 max-h-[360px] overflow-y-auto rounded-lg border border-hairline bg-canvas py-1 shadow-overlay">
          {places.map((place, index) => (
            <li key={`${place.kind}-${place.name}-${place.lat}-${place.lon}`} id={`${list}-${index}`} role="option" aria-selected={place === current}>
              <button type="button" tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(place)} className="block w-full text-left">
                <PlaceRow place={place} query={text} active={place === current} />
              </button>
            </li>
          ))}
          {state === "searching-more" ? (
            <li className="flex items-center gap-2 px-3 py-2 text-caption text-ink-tertiary">
              <LoadingDots label="Searching more places" />
              Searching more places
            </li>
          ) : null}
          {places.length === 0 && state === "done" ? <li className="px-3 py-2.5 text-small text-ink-tertiary">No town or district by that name. Try the nearest bigger town.</li> : null}
          {state === "failed" ? <li className="px-3 py-2.5 text-small text-fault">Search is not answering. Try again in a moment.</li> : null}
          {places.length === 0 && state === "searching" ? (
            <li className="flex items-center gap-2 px-3 py-2.5 text-small text-ink-tertiary">
              <LoadingDots label="Searching" />
              Searching
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
