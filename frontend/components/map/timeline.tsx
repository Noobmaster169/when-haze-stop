"use client";

import { useEffect, useRef } from "react";

import { Icon } from "@/components/ui/icons";
import { malaysiaDay, malaysiaMidnights, malaysiaWhen } from "@/lib/malaysia-time";

/**
 * The strip under the map: where in the week the map is, with the readings
 * behind the Now mark and the forecast ahead of it.
 */

interface Props {
  from: number;
  to: number;
  /** The newest reading: everything after it is forecast. */
  now: number;
  at: number;
  playing: boolean;
  onSeek(at: number): void;
  onPlaying(playing: boolean): void;
}

const STEP_MS = 15 * 60_000;
/** Hours of the timeline passed each second of play: the whole span in about half a minute. */
const HOURS_A_SECOND = 9;

function describe(at: number, now: number): string {
  const hours = Math.round((at - now) / 3_600_000);
  if (hours === 0) return "Latest readings";
  return hours < 0 ? "Past readings" : `Forecast, ${hours} h ahead`;
}

export function Timeline({ from, to, now, at, playing, onSeek, onPlaying }: Props) {
  const position = useRef(at);
  useEffect(() => {
    position.current = at;
  }, [at]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let request = requestAnimationFrame(function tick(time) {
      const next = position.current + Math.min(100, time - last) * 3_600 * HOURS_A_SECOND;
      last = time;
      if (next >= to) {
        onSeek(to);
        onPlaying(false);
        return;
      }
      position.current = next;
      onSeek(next);
      request = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(request);
  }, [playing, to, onSeek, onPlaying]);

  const share = (moment: number): string => `${((moment - from) / (to - from)) * 100}%`;
  const toggle = (): void => {
    if (!playing && at >= to) onSeek(from);
    onPlaying(!playing);
  };

  return (
    <div className="@container shrink-0 border-t border-hairline bg-canvas px-4 py-2.5 md:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play the timeline"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-hairline-strong text-ink-secondary hover:bg-active hover:text-ink"
        >
          <Icon name={playing ? "pause" : "play"} size={14} />
        </button>

        <div className="w-[164px] shrink-0 grow @[760px]:grow-0">
          <p className="text-strong font-medium text-ink">{malaysiaWhen(at)}</p>
          <p className={`text-caption ${at > now ? "text-accent" : "text-ink-tertiary"}`}>{describe(at, now)}</p>
        </div>

        <div className="relative order-last w-full min-w-0 pb-5 @[760px]:order-none @[760px]:w-auto @[760px]:grow">
          <div aria-hidden="true" className="absolute top-[9px] h-1 rounded-full bg-accent-tint" style={{ left: share(now), right: 0 }} />
          <input
            type="range"
            min={from}
            max={to}
            step={STEP_MS}
            value={at}
            onChange={(event) => {
              onPlaying(false);
              onSeek(Number(event.target.value));
            }}
            aria-label="Time"
            aria-valuetext={malaysiaWhen(at)}
            className="relative block h-[22px] w-full cursor-pointer accent-[var(--accent)]"
          />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-4 text-micro text-ink-tertiary">
            {malaysiaMidnights(from, to).map((midnight) => (
              <span key={midnight} className="absolute border-l border-hairline-strong pl-1 leading-4" style={{ left: share(midnight) }}>
                {malaysiaDay(midnight)}
              </span>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onPlaying(false);
            onSeek(now);
          }}
          disabled={at === now}
          className="h-8 shrink-0 rounded-md border border-hairline-strong px-3 text-small font-medium text-ink-secondary hover:bg-active hover:text-ink disabled:cursor-default disabled:text-ink-faint disabled:hover:bg-transparent"
        >
          Now
        </button>
      </div>
    </div>
  );
}
