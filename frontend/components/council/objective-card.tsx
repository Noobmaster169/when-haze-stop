"use client";

import { useEffect, useRef } from "react";

/**
 * The one line the whole meeting answers to. When the person has just
 * convened the council it arrives from below and settles with a warm flash,
 * so nobody misses what was asked; replaying an old run it is simply there.
 */
export function ObjectiveCard({ targetName, arrived }: { targetName: string; arrived: boolean }) {
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = card.current;
    if (!element || !arrived || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const travel = element.animate(
      [
        { transform: "translateY(56px) scale(0.94)", opacity: 0 },
        { transform: "translateY(-4px) scale(1.01)", opacity: 1, offset: 0.7 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 900, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "both" },
    );
    const glow = element.animate(
      [{ boxShadow: "0 0 0 0 var(--accent-line)", backgroundColor: "var(--accent-tint)" }, { boxShadow: "0 0 0 10px transparent", backgroundColor: "var(--surface)" }],
      { duration: 1600, delay: 500, easing: "ease-out", fill: "both" },
    );
    return () => {
      travel.cancel();
      glow.cancel();
    };
  }, [arrived]);

  return (
    <div ref={card} className="inline-flex max-w-full items-center gap-3 rounded-xl border border-hairline bg-surface py-2 pr-4 pl-3">
      <svg viewBox="0 0 20 20" className="size-5 shrink-0" aria-hidden>
        <circle cx="10" cy="10" r="8.5" fill="none" stroke="var(--accent)" strokeWidth="1.4" />
        <circle cx="10" cy="10" r="4.5" fill="none" stroke="var(--accent)" strokeWidth="1.4" />
        <circle cx="10" cy="10" r="1.4" fill="var(--accent)" />
      </svg>
      <div className="min-w-0">
        <div className="text-micro text-ink-tertiary">Objective</div>
        <div className="font-display text-[19px] leading-[25px] text-ink">Clear the haze over {targetName}</div>
      </div>
    </div>
  );
}
