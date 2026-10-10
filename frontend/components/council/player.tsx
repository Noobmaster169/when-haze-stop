"use client";

import { useEffect, useRef } from "react";

import { Icon } from "@/components/ui/icons";
import type { StageId } from "@/lib/api/council-schemas";

import type { StageMark } from "./timeline";
import { type Playback, SPEEDS } from "./use-playback";
import { clockText, STAGE_LABEL, STAGE_ORDER } from "./words";

/**
 * Play, pause, speed, a scrubber and the nine stages. The scrubber's fill and
 * the clock text are painted from the frame loop, so dragging and playing
 * never re-render the bar.
 */

export function Player({ playback, duration, stages, stage, live }: { playback: Playback; duration: number; stages: StageMark[]; stage: StageId | null; live: boolean }) {
  const fill = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const time = useRef<HTMLSpanElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(
    () =>
      playback.subscribe((clock) => {
        const share = clock.duration > 0 ? clock.t / clock.duration : 0;
        if (fill.current) fill.current.style.transform = `scaleX(${share})`;
        if (head.current) head.current.style.transform = `translateX(${(share * (track.current?.clientWidth ?? 0)).toFixed(1)}px)`;
        const text = `${clockText(clock.t)} / ${clockText(clock.duration)}`;
        if (time.current && time.current.textContent !== text) {
          time.current.textContent = text;
          track.current?.setAttribute("aria-valuenow", String(Math.round(clock.t)));
        }
      }),
    [playback],
  );

  const seekTo = (clientX: number) => {
    const box = track.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    playback.seek(((clientX - box.left) / box.width) * duration);
  };
  const firstOf = (id: StageId) => stages.find((mark) => mark.stage === id);

  return (
    <div className="border-t border-hairline bg-canvas px-4 pt-3 pb-3 md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={playback.toggle}
          aria-label={playback.playing ? "Pause" : "Play"}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-ink-inverse transition-transform duration-150 hover:scale-105 active:scale-95"
        >
          <Icon name={playback.playing ? "pause" : "play"} size={14} />
        </button>
        <span ref={time} className="w-[88px] shrink-0 text-small text-ink-secondary tabular-nums">
          0:00 / {clockText(duration)}
        </span>
        <div
          ref={track}
          role="slider"
          tabIndex={-1}
          aria-label="Replay position"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={0}
          className="relative h-6 min-w-0 grow cursor-pointer touch-none"
          onPointerDown={(event) => {
            dragging.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            seekTo(event.clientX);
          }}
          onPointerMove={(event) => dragging.current && seekTo(event.clientX)}
          onPointerUp={() => (dragging.current = false)}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-sunken">
            <div ref={fill} className="h-full w-full origin-left scale-x-0 bg-ink-tertiary" />
          </div>
          {stages.map((mark) => (
            <span
              key={`${mark.stage}-${mark.start}`}
              className={`absolute top-1/2 h-2.5 w-px -translate-y-1/2 ${mark.stage === stage ? "bg-accent" : "bg-hairline-strong"}`}
              style={{ left: `${duration > 0 ? (100 * mark.start) / duration : 0}%` }}
            />
          ))}
          <div ref={head} className="pointer-events-none absolute top-1/2 left-0 -mt-[7px] -ml-[7px] size-3.5 rounded-full border-2 border-canvas bg-ink shadow-overlay" />
        </div>
        {live ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-fault-tint px-2 py-0.5 text-caption font-medium text-fault">
            <span className="size-1.5 animate-pulse rounded-full bg-fault" />
            Live
          </span>
        ) : null}
        <div className="flex shrink-0 rounded-md bg-sunken p-0.5" role="group" aria-label="Speed">
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={playback.speed === value}
              onClick={() => playback.setSpeed(value)}
              className={`rounded-sm px-1.5 py-0.5 text-caption tabular-nums transition-colors sm:px-2 ${playback.speed === value ? "bg-canvas text-ink shadow-overlay" : "text-ink-tertiary hover:text-ink"}`}
            >
              {value}x
            </button>
          ))}
        </div>
      </div>
      <ol className="mt-2.5 hidden gap-1 md:flex">
        {STAGE_ORDER.map((id, position) => {
          const mark = firstOf(id);
          const current = id === stage;
          return (
            <li key={id} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!mark}
                onClick={() => mark && playback.seek(mark.start + 0.01)}
                title={mark ? `Jump to ${mark.title} (key ${position + 1})` : "Not reached yet"}
                className={`flex w-full min-w-0 items-baseline gap-1.5 border-t-2 pt-1.5 text-left text-caption transition-colors ${current ? "border-accent text-ink" : mark ? "border-hairline text-ink-secondary hover:border-hairline-strong hover:text-ink" : "border-hairline-faint text-ink-faint"}`}
              >
                <span className="tabular-nums text-ink-tertiary">{position + 1}</span>
                <span className="truncate">{STAGE_LABEL[id]}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
