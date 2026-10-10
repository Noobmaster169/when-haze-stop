"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icons";
import { malaysiaDay, malaysiaMidnights, malaysiaWhen } from "@/lib/malaysia-time";

/**
 * The strip under the map: where in the week the map is, with the readings
 * behind the Now mark and the forecast ahead of it. The line is drawn here and
 * a transparent native range sits over it, so keyboard and screen readers get
 * a real slider.
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
/** A day label this far along has no room before the end of the strip, so it is left out. */
const LAST_LABEL = 0.94;
/** The forecast part of the line is dashed, as the forecast is in every chart. */
const FORECAST_DASHES = "repeating-linear-gradient(90deg, var(--accent-line) 0 6px, transparent 6px 10px)";

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

  const [focused, setFocused] = useState(false);
  const fraction = (moment: number): number => Math.min(1, Math.max(0, (moment - from) / (to - from)));
  const share = (moment: number): string => `${fraction(moment) * 100}%`;
  // The Now pill is centred on its line, except near an end, where it would hang off the strip.
  const pillShift = (moment: number): string => (fraction(moment) < 0.04 ? "0" : fraction(moment) > 0.96 ? "-100%" : "-50%");
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

        <div className="relative order-last w-full min-w-0 pt-6 pb-5 @[760px]:order-none @[760px]:w-auto @[760px]:grow">
          <div aria-hidden="true" className="relative h-5">
            <div className="absolute inset-x-0 top-2 h-1 rounded-full bg-hairline-strong" style={{ right: `calc(100% - ${share(now)})` }} />
            <div className="absolute top-2 h-1 rounded-r-full" style={{ left: share(now), right: 0, backgroundImage: FORECAST_DASHES }} />
            <div className="absolute left-0 top-2 h-1 rounded-l-full bg-accent" style={{ width: share(Math.min(at, now)) }} />
            <div className="absolute -top-6 bottom-0 flex flex-col items-center" style={{ left: share(now), transform: `translateX(${pillShift(now)})` }}>
              <span className="flex items-center gap-1 rounded-full bg-accent px-1.5 text-micro font-semibold leading-4 text-ink-inverse shadow-overlay">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-ink-inverse opacity-75 motion-reduce:hidden" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-ink-inverse" />
                </span>
                Now
              </span>
            </div>
            <div className="absolute -top-1 bottom-0 w-0.5 -translate-x-1/2 rounded-full bg-accent" style={{ left: share(now) }} />
            <div
              className="absolute top-0.5 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-accent bg-canvas shadow-overlay"
              style={{ left: share(at), boxShadow: focused ? "var(--focus-ring)" : undefined }}
            />
          </div>
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
            onFocus={(event) => setFocused(event.currentTarget.matches(":focus-visible"))}
            onBlur={() => setFocused(false)}
            aria-label="Time"
            aria-valuetext={`${malaysiaWhen(at)}, ${describe(at, now).toLowerCase()}`}
            className="absolute inset-x-0 top-5 h-7 w-full cursor-pointer opacity-0"
          />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-4 text-micro text-ink-tertiary">
            {malaysiaMidnights(from, to)
              .filter((midnight) => (midnight - from) / (to - from) < LAST_LABEL)
              .map((midnight, index) => (
                <span
                  key={midnight}
                  className={`absolute whitespace-nowrap border-l border-hairline-strong pl-1 leading-4 ${index % 2 === 1 ? "hidden @[640px]:block" : ""}`}
                  style={{ left: share(midnight) }}
                >
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
