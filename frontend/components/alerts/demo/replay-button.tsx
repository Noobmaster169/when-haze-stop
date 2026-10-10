"use client";

import { Icon } from "@/components/ui/icons";

import { ReplayCard } from "./replay-card";
import { playReplay } from "./replay-player";

/** Plays the 8 October replay: alerts under the island, on this device, and as a timeline. */
export function ReplayButton() {
  return (
    <>
      <button
        type="button"
        onClick={playReplay}
        className="flex h-8 items-center gap-2 rounded-md bg-ink px-3 text-small font-medium text-ink-inverse transition-opacity duration-150 hover:opacity-90"
      >
        <Icon name="play" size={12} />
        Play a demo alert
      </button>
      <ReplayCard />
    </>
  );
}
