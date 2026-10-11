"use client";

import useSWR from "swr";

import { type AlertEvent, AlertFeed } from "@/lib/api/alert-schemas";
import { parsedFetcher } from "@/lib/poll";

import { useSessionId } from "./session";

/** The alerts sent for the areas this browser follows, newest first. One key, so the toasts, the island and the page share one poll. */

const fetcher = parsedFetcher(AlertFeed);

export function useAlertFeed(): { events: AlertEvent[]; loaded: boolean; failed: boolean } {
  const session = useSessionId();
  const { data, error } = useSWR(session ? `/api/alerts?session=${session}` : null, fetcher, { refreshInterval: 60_000 });
  return { events: data?.events ?? [], loaded: data !== undefined, failed: error !== undefined };
}
