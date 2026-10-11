"use client";

import { useState } from "react";

import type { AlertEvent } from "@/lib/api/alert-schemas";
import { malaysiaWhen } from "@/lib/malaysia-time";

import { TONE } from "./alert-tone";
import { feedOrder } from "./feed-order";
import { markSeen, useSeen } from "./seen";
import { hasSeen } from "./seen-state";
import { useAlertFeed } from "./use-alert-feed";

/** What was sent for the areas this browser follows, so an alert closed in a toast can still be read. */

const FIRST = 8;

export function LatestAlerts() {
  const { events, loaded, failed } = useAlertFeed();
  const seen = useSeen();
  const [all, setAll] = useState(false);
  const ordered = feedOrder(events);
  // An ended alert no longer asks for anything, so only active ones count as new, as in the toasts.
  const fresh = (event: AlertEvent): boolean => event.open && !hasSeen(seen, event.id);
  const unread = ordered.filter(fresh).map((event) => event.id);
  const listed = all ? ordered : ordered.slice(0, FIRST);

  return (
    <section id="latest" aria-labelledby="latest-title" className="scroll-mt-20">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="latest-title" className="text-title font-medium text-ink">
          Latest alerts
        </h2>
        <span className="grow" />
        {unread.length > 0 ? (
          <button type="button" onClick={() => markSeen(unread)} className="h-7 rounded-sm px-2.5 text-small text-ink-tertiary hover:bg-active hover:text-ink">
            Mark all read
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-small text-ink-secondary">What was sent for your areas. An alert is active while what it says still holds.</p>

      {failed ? <p className="mt-4 text-small text-fault">The alerts could not be loaded.</p> : null}
      {loaded && ordered.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-hairline-strong px-4 py-3 text-small text-ink-tertiary">
          Nothing yet. When the forecast says schools may close in an area you follow, or an official order covers it, the alert shows here and slides in at the top right of every page.
        </p>
      ) : null}

      {listed.length > 0 ? (
        <ul className="mt-2 divide-y divide-hairline-faint">
          {listed.map((event) => {
            const tone = TONE[event.kind];
            return (
              <li key={event.id} className="flex items-start gap-3 py-3">
                <span aria-hidden className={`mt-2 h-2 w-2 shrink-0 rounded-full ${event.open ? tone.dot : "bg-ink-faint"}`} />
                <div className="min-w-0 grow">
                  <p className="flex flex-wrap items-center gap-x-2 text-caption">
                    <span className={`font-semibold tracking-[0.04em] uppercase ${event.open ? tone.text : "text-ink-tertiary"}`}>{tone.label}</span>
                    <span className="font-medium text-ink-secondary">{event.stationName}</span>
                    <span className="text-ink-tertiary tabular-nums">{malaysiaWhen(event.createdAt)}</span>
                    {fresh(event) ? <span className="rounded-sm bg-accent-tint px-1.5 font-medium text-accent">New</span> : null}
                  </p>
                  <p className={`mt-0.5 text-body ${event.open ? "text-ink" : "text-ink-secondary"}`}>{event.message}</p>
                </div>
                <span className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-caption font-medium ${event.open ? "border-hairline-strong text-ink" : "border-hairline text-ink-tertiary"}`}>
                  {event.open ? "Active" : "Ended"}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {ordered.length > FIRST ? (
        <button type="button" onClick={() => setAll(!all)} className="mt-1 text-small text-ink-tertiary hover:text-ink">
          {all ? "Show fewer" : `Show all ${ordered.length}`}
        </button>
      ) : null}
    </section>
  );
}
