"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

import type { CouncilEvent } from "@/lib/api/council-schemas";

import { captionFor } from "./caption";
import { CouncilGraph } from "./graph";
import { ObjectiveCard } from "./objective-card";
import { Player } from "./player";
import { Rail } from "./rail";
import { beatIndexAt, buildTimeline } from "./timeline";
import { usePlayback, usePrefersReducedMotion } from "./use-playback";
import { STAGE_ORDER } from "./words";

/**
 * The meeting, replayed: the objective and what is happening over the table,
 * the speaker and the plans beside it, the player under both. A live run is
 * the same replay with its playhead held at the newest event.
 */

const SKIP_SECONDS = 5;

function typingInto(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function Replay({ events, live, targetName, arrived, onVerdict, header }: { events: CouncilEvent[]; live: boolean; targetName: string; arrived: boolean; onVerdict: (() => void) | null; header: ReactNode }) {
  const timeline = useMemo(() => buildTimeline(events), [events]);
  const reduced = usePrefersReducedMotion();
  const [startAt] = useState(() => (live ? Math.max(0, timeline.duration - 2) : 0));
  const playback = usePlayback(timeline.duration, live, startAt);
  const [index, setIndex] = useState(() => beatIndexAt(timeline, startAt));
  const [atEnd, setAtEnd] = useState(false);
  const { play, toggle, seek, clock, subscribe } = playback;

  // Opening a replay is asking to watch it, and a live run plays up to its tail.
  useEffect(() => {
    play();
  }, [live, play]);

  useEffect(
    () =>
      subscribe((state) => {
        const next = beatIndexAt(timeline, state.t);
        setIndex((current) => (current === next ? current : next));
        const ended = !state.live && state.duration > 0 && state.t >= state.duration - 0.05;
        setAtEnd((current) => (current === ended ? current : ended));
      }),
    [subscribe, timeline],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (typingInto(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === " ") {
        event.preventDefault();
        toggle();
      } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        seek(clock.current.t + (event.key === "ArrowRight" ? SKIP_SECONDS : -SKIP_SECONDS));
      } else if (/^[1-9]$/.test(event.key)) {
        const mark = timeline.stages.find((item) => item.stage === STAGE_ORDER[Number(event.key) - 1]);
        if (mark) seek(mark.start + 0.01);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, seek, clock, timeline]);

  const beat = index >= 0 ? timeline.beats[index] : null;
  let stage = null;
  for (const mark of timeline.stages) if (beat && mark.start <= beat.start) stage = mark;
  const caption = live && events.length === 0 ? "The council is gathering: the engine is reading the fires, the wind and the air." : captionFor(beat?.event ?? null, timeline.agents);

  return (
    <div className="flex min-h-0 grow flex-col">
      <div className="flex min-h-0 grow flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div className="relative flex min-w-0 shrink-0 flex-col lg:min-h-0 lg:shrink lg:grow">
          <div className="px-5 pt-20 md:px-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <ObjectiveCard targetName={targetName} arrived={arrived} />
              {header}
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {stage && beat?.event.kind !== "stage" ? (
                <span className="text-caption font-medium text-ink-tertiary tabular-nums">
                  Stage {stage.index} of {stage.of}, {stage.title.toLowerCase()}
                </span>
              ) : null}
              <p key={caption} className="text-body text-ink motion-safe:animate-[island-drop_260ms_var(--ease-island)_both]">
                {caption}
              </p>
              {atEnd && onVerdict ? (
                <button type="button" onClick={onVerdict} className="rounded-full bg-ink px-4 py-1.5 text-strong font-medium text-ink-inverse shadow-overlay transition-transform hover:scale-[1.02] motion-safe:animate-[island-drop_420ms_var(--ease-island)_both]">
                  Read the verdict
                </button>
              ) : null}
            </div>
          </div>
          <div className="relative h-[min(112vw,600px)] px-1 md:px-6 lg:h-auto lg:min-h-0 lg:grow">
            <CouncilGraph timeline={timeline} playback={playback} reduced={reduced} />
          </div>
          <p className="px-5 pb-2 text-caption text-ink-tertiary md:px-8">The seats are offices, role-played by AI. Every figure they cite comes from the engine or the stored data.</p>
        </div>
        <aside className="flex min-h-0 w-full shrink-0 flex-col border-t border-hairline bg-surface lg:w-[360px] lg:border-t-0 lg:border-l lg:pt-16">
          <Rail timeline={timeline} index={index} onSeek={(position) => seek(timeline.beats[position].start + 0.01)} />
        </aside>
      </div>
      <Player playback={playback} duration={timeline.duration} stages={timeline.stages} stage={stage?.stage ?? null} live={live} />
    </div>
  );
}
