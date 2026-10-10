"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * The replay's clock: one requestAnimationFrame loop that advances playback
 * time and hands it to whoever draws. Time lives in a ref, not in React state,
 * so a frame never re-renders the page; the graph and the scrubber subscribe
 * and paint themselves, and React only hears about play, pause and speed.
 *
 * Live: the playhead runs up to the newest event and waits there for more.
 */

export interface Clock {
  t: number;
  playing: boolean;
  speed: number;
  duration: number;
  live: boolean;
}

export type FrameListener = (clock: Clock, wallSeconds: number) => void;

export interface Playback {
  clock: React.RefObject<Clock>;
  playing: boolean;
  speed: number;
  subscribe(listener: FrameListener): () => void;
  toggle(): void;
  play(): void;
  pause(): void;
  seek(t: number): void;
  setSpeed(speed: number): void;
}

export const SPEEDS = [0.5, 1, 2, 4] as const;

export function usePlayback(duration: number, live: boolean, startAt: number): Playback {
  const clock = useRef<Clock>({ t: startAt, playing: false, speed: 1, duration, live });
  const listeners = useRef(new Set<FrameListener>());
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState(1);

  useEffect(() => {
    clock.current.duration = duration;
    clock.current.live = live;
    clock.current.t = Math.min(clock.current.t, duration);
  }, [duration, live]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      // A long gap (a background tab) is not played through in one jump.
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const state = clock.current;
      if (state.playing) {
        state.t = Math.min(state.duration, state.t + dt * state.speed);
        if (state.t >= state.duration && !state.live) {
          state.playing = false;
          setPlaying(false);
        }
      }
      for (const listener of listeners.current) listener(state, now / 1000);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  const play = useCallback(() => {
    if (clock.current.t >= clock.current.duration && !clock.current.live) clock.current.t = 0;
    clock.current.playing = true;
    setPlaying(true);
  }, []);
  const pause = useCallback(() => {
    clock.current.playing = false;
    setPlaying(false);
  }, []);
  const toggle = useCallback(() => (clock.current.playing ? pause() : play()), [pause, play]);
  const seek = useCallback((t: number) => {
    clock.current.t = Math.max(0, Math.min(clock.current.duration, t));
  }, []);
  const setSpeed = useCallback((next: number) => {
    clock.current.speed = next;
    setSpeedState(next);
  }, []);
  const subscribe = useCallback((listener: FrameListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  return { clock, playing, speed, subscribe, toggle, play, pause, seek, setSpeed };
}

const REDUCED = "(prefers-reduced-motion: reduce)";

function watchReduced(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Whether the person asked for less motion, live. The server renders full motion and the browser corrects it. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    watchReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}
