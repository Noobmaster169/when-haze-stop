"use client";

import Link from "next/link";

import { REPLAY_STATION, replayAlertsAt } from "@/components/alerts/demo/replay";
import { useReplayStep } from "@/components/alerts/demo/replay-player";
import { toastsFrom } from "@/components/alerts/feed-order";
import { markSeen, useSeen } from "@/components/alerts/seen";
import { ToastCard } from "@/components/alerts/toast-card";
import { useAlertFeed } from "@/components/alerts/use-alert-feed";
import type { AlertKind } from "@/lib/api/alert-schemas";
import { malaysiaWhen } from "@/lib/malaysia-time";

/**
 * New alerts, sliding in from the right edge at the top right of the page
 * column, so they sit beside the chat when it is open. They stay until closed:
 * they are about schools closing, and a timer could take one away unread.
 */

/** The kind of the newest unread alert, or the replay's, for the island's dot. */
export function useNewestAlertKind(): AlertKind | null {
  const { events } = useAlertFeed();
  const seen = useSeen();
  const [replayed] = replayAlertsAt(useReplayStep());
  if (replayed) return replayed.alert.kind;
  return toastsFrom(events, seen).toasts[0]?.kind ?? null;
}

export function AlertToasts() {
  const { events } = useAlertFeed();
  const seen = useSeen();
  const step = useReplayStep();
  const { toasts, more } = toastsFrom(events, seen);

  // A replay, while it runs, stands in for the real alerts and says it is a replay.
  const replayed = step > 0 ? replayAlertsAt(step) : null;
  if (!replayed && toasts.length === 0) return null;

  return (
    <section aria-label="New alerts" aria-live="polite" className="pointer-events-none absolute inset-x-3 top-16 z-30 flex flex-col gap-2 sm:left-auto sm:w-[360px]">
      {replayed
        ? replayed.map(({ at, alert }) => <ToastCard key={alert.kind} kind={alert.kind} place={REPLAY_STATION} when={at} message={alert.message} tag="Replay" />)
        : toasts.map((event) => (
            <ToastCard
              key={event.id}
              kind={event.kind}
              place={event.stationName}
              when={malaysiaWhen(event.createdAt)}
              message={event.message}
              action={{ label: "See area", href: `/alerts#area-${event.stationId}`, onFollow: () => markSeen([event.id]) }}
              onClose={() => markSeen([event.id])}
            />
          ))}
      {!replayed && more > 0 ? (
        <Link href="/alerts#latest" className="pointer-events-auto self-end rounded-full bg-ink px-3 py-1 text-caption font-medium text-ink-inverse shadow-overlay hover:opacity-90">
          {more} more on the Alerts page
        </Link>
      ) : null}
    </section>
  );
}
