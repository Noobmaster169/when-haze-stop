"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

import { Icon } from "@/components/ui/icons";
import { AlertFeed } from "@/lib/api/alert-schemas";
import { malaysiaWhen } from "@/lib/malaysia-time";
import { parsedFetcher } from "@/lib/poll";

import { TONE } from "./alert-tone";
import { useSessionId } from "./session";

/**
 * The broadcast: one line across the top of every page when a followed
 * station has something new to say. It shows the newest alert not yet
 * dismissed, and dismissing it dismisses everything up to it.
 */

const SEEN_KEY = "haze.alerts.seen";
const fetcher = parsedFetcher(AlertFeed);

function seenUpTo(): number {
  try {
    return Number(window.localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function AlertBar() {
  const session = useSessionId();
  const { data } = useSWR(session ? `/api/alerts?session=${session}` : null, fetcher, { refreshInterval: 60_000 });
  const [dismissed, setDismissed] = useState(0);

  const seen = Math.max(dismissed, session ? seenUpTo() : 0);
  const fresh = (data?.events ?? []).filter((event) => event.id > seen);
  const [newest] = fresh;
  if (!newest) return null;

  const tone = TONE[newest.kind];
  const dismiss = (): void => {
    try {
      window.localStorage.setItem(SEEN_KEY, String(newest.id));
    } catch {
      // Not kept in a private window; it stays dismissed for this visit.
    }
    setDismissed(newest.id);
  };

  return (
    <div role="alert" className={`flex min-h-10 shrink-0 items-center gap-3 border-b px-4 py-2 md:px-6 ${tone.box}`}>
      <span className={`shrink-0 text-caption font-semibold uppercase tracking-[0.04em] ${tone.text}`}>{tone.label}</span>
      <p className="min-w-0 grow text-strong text-ink">
        {newest.message} <span className="whitespace-nowrap text-caption text-ink-tertiary">{malaysiaWhen(newest.createdAt)}</span>
      </p>
      {fresh.length > 1 ? (
        <Link href="/alerts" className="shrink-0 text-small text-ink-secondary underline-offset-2 hover:underline">
          {fresh.length - 1} more
        </Link>
      ) : null}
      <Link href={`/map?station=${newest.stationId}`} className="shrink-0 text-small font-medium text-ink underline-offset-2 hover:underline">
        Show on map
      </Link>
      <button type="button" onClick={dismiss} aria-label="Dismiss this alert" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-ink-tertiary hover:bg-canvas hover:text-ink">
        <Icon name="close" size={13} />
      </button>
    </div>
  );
}
