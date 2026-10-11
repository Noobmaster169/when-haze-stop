"use client";

import { useEffect } from "react";
import useSWR from "swr";

import { AreaList } from "@/lib/api/alert-schemas";
import { parsedFetcher } from "@/lib/poll";

import { AreaCardView } from "./area-card";
import { FollowSearch } from "./follow-search";
import { NotifyToggle } from "./notify-toggle";
import { useSessionId } from "./session";
import type { Follows } from "./use-follows";

/** The areas this browser follows, each as a card, with a way to add one and to hear about them on the device. */

const fetcher = parsedFetcher(AreaList);

export function MyAreas({ follows }: { follows: Follows }) {
  const session = useSessionId();
  const { data, error } = useSWR(session ? `/api/alerts/areas?session=${session}` : null, fetcher, { refreshInterval: 120_000 });

  // A toast links to its area's card, which only exists once the cards have loaded.
  const loaded = data !== undefined;
  useEffect(() => {
    if (!loaded || !window.location.hash.startsWith("#area-")) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [loaded]);

  return (
    <section aria-labelledby="my-areas">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="my-areas" className="text-title font-medium text-ink">
          My areas
        </h2>
        <span className="grow" />
        <NotifyToggle />
      </div>
      <p className="mt-1 text-small text-ink-secondary">Tomorrow&apos;s forecast against the closing lines, four days of peaks, and any order in force.</p>

      {error ? <p className="mt-4 text-small text-fault">Your areas could not be loaded.</p> : null}
      <div className="mt-4 grid gap-3 @[760px]:grid-cols-2">
        {data?.areas.map((area) => <AreaCardView key={area.stationId} area={area} onStop={() => void follows.unfollow(area.stationId)} />)}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-small font-medium text-ink-secondary">Follow another area</p>
        <FollowSearch follows={follows} />
      </div>
    </section>
  );
}
