"use client";

import { useEffect } from "react";

import { Icon } from "@/components/ui/icons";

import { LAST_STEP, REPLAY_PLACE, REPLAY_STEPS } from "./replay";
import { nextStep, previousStep, stopReplay, useReplayStep } from "./replay-player";

/**
 * The presenter's bar for the replay, bottom centre of the page: the clock of
 * the moment, what happened and why it matters, and the controls. The alerts
 * themselves slide in at the top right, where a real one would.
 */

function typing(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

export function ReplayBar() {
  const step = useReplayStep();

  useEffect(() => {
    if (step === 0) return;
    const keys = (event: KeyboardEvent): void => {
      if (typing(event.target)) return;
      if (event.key === "Escape") stopReplay();
      if (event.key === "ArrowRight") nextStep();
      if (event.key === "ArrowLeft") previousStep();
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [step]);

  if (step === 0) return null;
  const moment = REPLAY_STEPS[step - 1];
  const last = step === LAST_STEP;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-3">
      <section aria-label={`Replay of ${REPLAY_PLACE}, 8 October 2026`} className="pointer-events-auto w-full max-w-[600px] rounded-xl bg-ink p-4 text-ink-inverse shadow-overlay motion-safe:animate-[rise-in_420ms_var(--ease-island)_both]">
        <header className="flex items-center gap-2 text-caption">
          <span className="text-strong font-semibold tabular-nums">{moment.at}</span>
          <span className="min-w-0 grow truncate text-ink-inverse/60">Replay · {REPLAY_PLACE}</span>
          <button type="button" onClick={stopReplay} aria-label="End the replay" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-inverse/60 hover:bg-ink-inverse/10 hover:text-ink-inverse">
            <Icon name="close" size={12} />
          </button>
        </header>
        <p key={step} aria-live="polite" className="mt-1.5 text-body motion-safe:animate-[island-drop_260ms_var(--ease-island)_both]">
          {moment.caption}
        </p>
        {step === 1 ? <p className="mt-1.5 text-caption text-ink-inverse/55">Recorded readings, forecast and statements. Nothing is sent to anyone.</p> : null}
        <footer className="mt-3.5 flex items-center gap-2">
          <ol className="flex grow gap-1.5" aria-label={`Step ${step} of ${LAST_STEP}`}>
            {REPLAY_STEPS.map((item, index) => (
              <li key={item.at} aria-hidden className={`h-1 w-6 rounded-full transition-colors duration-300 ${index < step ? "bg-ink-inverse" : "bg-ink-inverse/25"}`} />
            ))}
          </ol>
          <button
            type="button"
            onClick={previousStep}
            disabled={step === 1}
            className="h-8 rounded-md border border-ink-inverse/25 px-3 text-small text-ink-inverse/80 hover:bg-ink-inverse/10 hover:text-ink-inverse disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Back
          </button>
          <button type="button" onClick={nextStep} autoFocus className="flex h-8 items-center gap-1.5 rounded-md bg-ink-inverse px-3 text-small font-semibold text-ink hover:opacity-90">
            {last ? "Done" : "Next"}
            {last ? null : <Icon name="right" size={12} />}
          </button>
        </footer>
      </section>
    </div>
  );
}
