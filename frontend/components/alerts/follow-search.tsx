"use client";

import { useState } from "react";

import { PlaceSearch } from "@/components/map/place-search";
import { useMyLocation } from "@/components/map/my-location";

import type { Follows } from "./use-follows";

/** Find a town and follow its nearest DOE station, with this browser's nearest station offered first. */
export function FollowSearch({ follows }: { follows: Follows }) {
  const location = useMyLocation();
  const nearest = location && location !== "declined" ? location.nearest : null;
  // The lines alerts are judged on are Malaysia's, so a Singapore region is never offered.
  const suggest = nearest && nearest.network !== "nea" && follows.ready && !follows.follows(nearest.id) ? nearest : null;
  const [refused, setRefused] = useState<string | null>(null);

  return (
    <div>
      <div className="relative z-10 max-w-[420px]">
        <PlaceSearch
          onChoose={(place) => {
            if (!place.nearest) return;
            if (place.nearest.network !== "doe") {
              setRefused(place.nearest.name);
              return;
            }
            setRefused(null);
            void follows.follow(place.nearest.id);
          }}
        />
      </div>
      {refused ? <p className="mt-2 text-small text-ink-tertiary">{refused} is an NEA region. Alerts follow Malaysia&apos;s official lines, so none are raised there.</p> : null}
      {suggest ? (
        <div className="mt-3 flex max-w-[520px] items-center gap-3 rounded-lg border border-dashed border-hairline-strong px-4 py-3">
          <p className="min-w-0 grow text-small text-ink-secondary">
            <span className="font-medium text-ink">{suggest.name}</span> is your nearest station, {suggest.km} km away.
          </p>
          <button type="button" onClick={() => void follows.follow(suggest.id)} className="h-8 shrink-0 rounded-md bg-ink px-3 text-small font-medium text-ink-inverse">
            Follow
          </button>
        </div>
      ) : null}
    </div>
  );
}
