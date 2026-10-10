"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";

import { TONE } from "@/components/alerts/alert-tone";
import { useSessionId } from "@/components/alerts/session";
import { Icon } from "@/components/ui/icons";
import { type AlertEvent, AlertFeed } from "@/lib/api/alert-schemas";
import { parsedFetcher } from "@/lib/poll";

/**
 * The newest alert for an area this browser follows, as a line that hangs
 * under the island. Closing it marks it, and everything before it, seen.
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

/** Closing it in one place closes it everywhere it shows. */
let dismissedUpTo = 0;
const listeners = new Set<(id: number) => void>();

/** The newest alert not yet seen for an area this browser follows, and how to mark it seen. */
export function useUnseenAlert(): { alert: AlertEvent | null; dismiss(): void } {
  const session = useSessionId();
  const { data } = useSWR(session ? `/api/alerts?session=${session}` : null, fetcher, { refreshInterval: 60_000 });
  const [dismissed, setDismissed] = useState(dismissedUpTo);
  useEffect(() => {
    listeners.add(setDismissed);
    return () => {
      listeners.delete(setDismissed);
    };
  }, []);

  const seen = Math.max(dismissed, session ? seenUpTo() : 0);
  const alert = (data?.events ?? []).find((event) => event.id > seen && event.kind !== "observed") ?? null;
  const dismiss = (): void => {
    if (!alert) return;
    try {
      window.localStorage.setItem(SEEN_KEY, String(alert.id));
    } catch {
      // Not kept in a private window; it stays closed for this visit.
    }
    dismissedUpTo = alert.id;
    for (const listener of listeners) listener(alert.id);
  };
  return { alert, dismiss };
}

/** The line under the island. Below 900px the map's search sits there, so the island's Alerts icon carries a dot instead. */
export function IslandAlert() {
  const { alert: newest, dismiss } = useUnseenAlert();
  if (!newest) return null;
  const tone = TONE[newest.kind];

  return (
    <div role="status" className="hidden h-9 max-w-[min(560px,calc(100vw-24px))] animate-[island-drop_400ms_var(--ease-island)] items-center gap-2 rounded-full bg-ink pr-1 pl-3.5 shadow-overlay min-[900px]:flex">
      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
      <Link href="/alerts" className="min-w-0 truncate text-strong text-ink-inverse hover:underline">
        <span className="sr-only">{tone.label}: </span>
        {newest.message}
      </Link>
      <button type="button" onClick={dismiss} aria-label="Mark this alert seen" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-inverse/55 hover:bg-ink-inverse/10 hover:text-ink-inverse">
        <Icon name="close" size={12} />
      </button>
    </div>
  );
}
