"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/icons";

import { askPosition } from "./my-location";

/**
 * The first visit's question: show the haze where you are. The browser's own
 * prompt only appears after the button, so nobody is asked before they know why.
 */
export function LocateCard({ onLocated, onDecline }: { onLocated(lat: number, lon: number): void; onDecline(): void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const locate = async (): Promise<void> => {
    setBusy(true);
    setProblem(null);
    try {
      const { lat, lon } = await askPosition();
      onLocated(lat, lon);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Your location could not be found.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-label="See haze where you are" className="w-[min(320px,calc(100vw-24px))] rounded-lg border border-hairline bg-surface/95 p-4 shadow-overlay backdrop-blur">
      <p className="flex items-center gap-2 text-title font-medium text-ink">
        <Icon name="pin" size={15} className="text-accent" />
        See haze where you are
      </p>
      <p className="mt-1 text-small text-ink-secondary">The map opens on your area with its forecast. Your location stays in this browser.</p>
      {problem ? <p className="mt-2 text-small text-fault">{problem}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => void locate()} disabled={busy} className="h-8 rounded-md bg-ink px-3 text-small font-medium text-ink-inverse disabled:opacity-60">
          {busy ? "Finding you" : "Use my location"}
        </button>
        <button type="button" onClick={onDecline} className="h-8 rounded-md px-3 text-small text-ink-secondary hover:bg-active hover:text-ink">
          Not now
        </button>
      </div>
    </div>
  );
}
