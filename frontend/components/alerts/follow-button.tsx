"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/icons";

import { useFollows } from "./use-follows";

/** Turns a station's alerts on or off for this browser. */
export function FollowButton({ stationId, stationName }: { stationId: string; stationName: string }) {
  const follows = useFollows();
  const [busy, setBusy] = useState(false);
  const on = follows.follows(stationId);

  const toggle = async (): Promise<void> => {
    setBusy(true);
    try {
      await (on ? follows.unfollow(stationId) : follows.follow(stationId));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || !follows.ready}
      aria-pressed={on}
      aria-label={on ? `Stop alerts for ${stationName}` : `Alert me about ${stationName}`}
      className={`flex h-8 items-center gap-2 rounded-md border px-3 text-small font-medium transition-colors duration-150 disabled:opacity-60 ${
        on ? "border-accent-line bg-accent-tint text-accent" : "border-hairline-strong text-ink-secondary hover:bg-active hover:text-ink"
      }`}
    >
      <Icon name="bell" size={14} />
      {on ? "Alerts on" : "Alert me here"}
    </button>
  );
}
