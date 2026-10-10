"use client";

import { useCallback } from "react";
import useSWR, { mutate } from "swr";

import { type Subscription, SubscriptionList } from "@/lib/api/alert-schemas";
import { parsedFetcher } from "@/lib/poll";

import { refreshPush } from "./push";
import { useSessionId } from "./session";

/** The stations this browser follows, and the two things it can do about them. */

export interface Follows {
  list: Subscription[];
  ready: boolean;
  follows(stationId: string): boolean;
  follow(stationId: string): Promise<void>;
  unfollow(stationId: string): Promise<void>;
}

const fetcher = parsedFetcher(SubscriptionList);

/** Every alerts read, so a change made anywhere, the chat included, shows everywhere at once. */
export async function refreshAlerts(): Promise<void> {
  await mutate((key) => typeof key === "string" && key.startsWith("/api/alerts"));
}

export function useFollows(): Follows {
  const session = useSessionId();
  const { data } = useSWR(session ? `/api/alerts/subscriptions?session=${session}` : null, fetcher, { refreshInterval: 120_000 });
  const list = data?.subscriptions ?? [];

  const follow = useCallback(
    async (stationId: string) => {
      if (!session) return;
      await fetch("/api/alerts/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session, stationId }),
      });
      // A device already notified for other areas hears about this one too.
      await refreshPush(session);
      await refreshAlerts();
    },
    [session],
  );

  const unfollow = useCallback(
    async (stationId: string) => {
      if (!session) return;
      await fetch(`/api/alerts/subscriptions/${encodeURIComponent(stationId)}?session=${session}`, { method: "DELETE" });
      await refreshAlerts();
    },
    [session],
  );

  return { list, ready: data !== undefined, follows: (stationId) => list.some((item) => item.stationId === stationId), follow, unfollow };
}
