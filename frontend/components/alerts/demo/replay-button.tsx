"use client";

import { Icon } from "@/components/ui/icons";

import { startReplay } from "./replay-player";

/** Starts the 8 October replay; the bar and the alerts it shows live in the app shell. */
export function ReplayButton({ label = "See how alerts work" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={startReplay}
      className="flex h-8 shrink-0 items-center gap-2 rounded-md border border-hairline-strong px-3 text-small font-medium text-ink-secondary transition-colors duration-150 hover:bg-active hover:text-ink"
    >
      <Icon name="play" size={12} />
      {label}
    </button>
  );
}
