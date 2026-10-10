"use client";

import { useState } from "react";
import useSWR from "swr";

import { PlaceSearch } from "@/components/map/place-search";
import { useMyLocation } from "@/components/map/my-location";
import { AreaList } from "@/lib/api/alert-schemas";
import { parsedFetcher } from "@/lib/poll";

import { AreaCardView } from "./area-card";
import { ReplayButton } from "./demo/replay-button";
import { NotifyToggle } from "./notify-toggle";
import { useSessionId } from "./session";
import { useFollows } from "./use-follows";

/** The areas this browser follows, each as a card, with a way to add one. */

const fetcher = parsedFetcher(AreaList);

export function MyAreas() {
  const session = useSessionId();
  const follows = useFollows();
  const location = useMyLocation();
  const { data, error } = useSWR(session ? `/api/alerts/areas?session=${session}` : null, fetcher, { refreshInterval: 120_000 });
  const nearest = location && location !== "declined" ? location.nearest : null;
  // The lines alerts are judged on are Malaysia's, so a Singapore region is never offered.
  const suggest = nearest && nearest.network !== "nea" && follows.ready && !follows.follows(nearest.id) ? nearest : null;
  const [refused, setRefused] = useState<string | null>(null);

  return (
    <section aria-labelledby="my-areas">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="my-areas" className="text-title font-medium text-ink">
          My areas
        </h2>
        <span className="grow" />
        <NotifyToggle />
        <ReplayButton />
      </div>

      <div className="relative z-10 mt-3 max-w-[420px]">
        <PlaceSearch
          onChoose={(place) => {
            if (!place.nearest) return;
            // The lines alerts are judged on are Malaysia's, so a Singapore region cannot be followed.
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
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-dashed border-hairline-strong px-4 py-3">
          <p className="min-w-0 grow text-small text-ink-secondary">
            <span className="font-medium text-ink">{suggest.name}</span> is your nearest station, {suggest.km} km away.
          </p>
          <button type="button" onClick={() => void follows.follow(suggest.id)} className="h-8 shrink-0 rounded-md bg-ink px-3 text-small font-medium text-ink-inverse">
            Follow
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-4 text-small text-fault">Your areas could not be loaded.</p> : null}
      {data && data.areas.length === 0 && !suggest ? <p className="mt-4 text-small text-ink-tertiary">Search a town to follow it. You follow its nearest DOE station.</p> : null}
      <div className="mt-4 grid gap-3 @[760px]:grid-cols-2">
        {data?.areas.map((area) => <AreaCardView key={area.stationId} area={area} onStop={() => void follows.unfollow(area.stationId)} />)}
      </div>
    </section>
  );
}
