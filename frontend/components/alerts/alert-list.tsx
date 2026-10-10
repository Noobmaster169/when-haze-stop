"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

import { AlertFeed } from "@/lib/api/alert-schemas";
import { malaysiaWhen } from "@/lib/malaysia-time";
import { parsedFetcher } from "@/lib/poll";

import { TONE } from "./alert-tone";
import { useSessionId } from "./session";

/** What has been said, newest first: for the stations this browser follows, or for every station in the country. */

const fetcher = parsedFetcher(AlertFeed);

export function AlertList({ following }: { following: boolean }) {
  const session = useSessionId();
  const [everywhere, setEverywhere] = useState(false);
  const mine = following && !everywhere;
  const { data, error } = useSWR(session ? (mine ? `/api/alerts?session=${session}` : "/api/alerts") : null, fetcher, { refreshInterval: 60_000 });
  const tab = (active: boolean): string => `h-7 rounded-sm px-2.5 text-small ${active ? "bg-ink font-medium text-ink-inverse" : "text-ink-tertiary hover:bg-active hover:text-ink"}`;

  return (
    <section>
      <div className="flex items-center gap-3">
        <h2 className="text-title font-medium text-ink">Recent alerts</h2>
        <span className="grow" />
        {following ? (
          <div className="flex gap-0.5 rounded-md border border-hairline p-0.5" role="group" aria-label="Which alerts">
            <button type="button" aria-pressed={!everywhere} onClick={() => setEverywhere(false)} className={tab(!everywhere)}>
              My areas
            </button>
            <button type="button" aria-pressed={everywhere} onClick={() => setEverywhere(true)} className={tab(everywhere)}>
              All Malaysia
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-small text-fault">Alerts could not be loaded.</p> : null}
      {data && data.events.length === 0 ? <p className="mt-3 text-small text-ink-tertiary">{mine ? "Nothing has been raised for your areas yet." : "No alert has been raised yet."}</p> : null}

      <ul className="mt-3 divide-y divide-hairline-faint border-y border-hairline-faint empty:hidden">
        {data?.events.map((event) => (
          <li key={event.id} className="flex items-baseline gap-3 py-2.5">
            <span className={`w-[68px] shrink-0 text-caption font-semibold uppercase tracking-[0.04em] ${TONE[event.kind].text}`}>{TONE[event.kind].label}</span>
            <p className="min-w-0 grow text-body text-ink">{event.message}</p>
            <Link href={`/map?station=${event.stationId}`} className="shrink-0 whitespace-nowrap text-caption text-ink-tertiary underline-offset-2 hover:text-accent hover:underline">
              {malaysiaWhen(event.createdAt)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
