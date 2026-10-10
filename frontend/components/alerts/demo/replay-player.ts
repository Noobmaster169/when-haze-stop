"use client";

import { useSyncExternalStore } from "react";

import { REPLAY, REPLAY_DATE, type ReplayAlert } from "./replay";

/**
 * Plays the replay: each alert arrives a few seconds after the last, under the
 * island and as a notification on this device, then the outcome. Held in this
 * tab only; nothing is sent to the api.
 */

export interface ReplayState {
  /** Whether the replay card is open. */
  open: boolean;
  /** How many alerts have arrived so far. */
  arrived: number;
  /** The outcome is shown once every alert has arrived. */
  done: boolean;
  /** The island line was closed for the alert showing now. */
  dismissed: boolean;
  /** Whether this device showed the notifications, or why not. */
  device: "shown" | "blocked" | "unsupported" | null;
}

const IDLE: ReplayState = { open: false, arrived: 0, done: false, dismissed: false, device: null };
/** Long enough to read one alert before the next lands. */
const FIRST_MS = 900;
const BETWEEN_MS = 4500;

let state = IDLE;
let timers: ReturnType<typeof setTimeout>[] = [];
const listeners = new Set<() => void>();

function set(next: Partial<ReplayState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

async function notifyDevice(alert: ReplayAlert): Promise<ReplayState["device"]> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  if (Notification.permission !== "granted") return "blocked";
  const registration = (await navigator.serviceWorker.getRegistration("/sw.js")) ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  await registration.showNotification(alert.title, { body: `${alert.message} Replay of ${REPLAY_DATE}.`, tag: `replay-${alert.kind}`, data: { url: "/alerts" } });
  return "shown";
}

export function stopReplay(): void {
  for (const timer of timers) clearTimeout(timer);
  timers = [];
  set(IDLE);
}

/**
 * Asks for notifications on the click that started it, since a browser only
 * asks on one, but does not wait for the answer: a presenter who ignores the
 * prompt still sees the replay, and each alert checks the answer when it lands.
 */
export function playReplay(): void {
  stopReplay();
  set({ open: true });
  if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
  REPLAY.forEach((alert, index) => {
    timers.push(
      setTimeout(() => {
        set({ arrived: index + 1, dismissed: false });
        void notifyDevice(alert).then((device) => set({ device }));
      }, FIRST_MS + index * BETWEEN_MS),
    );
  });
  timers.push(setTimeout(() => set({ done: true }), FIRST_MS + REPLAY.length * BETWEEN_MS));
}

export function dismissReplayLine(): void {
  set({ dismissed: true });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useReplay(): ReplayState {
  return useSyncExternalStore(subscribe, () => state, () => IDLE);
}

/** The replayed alert the island should show now, if any. */
export function useReplayLine(): ReplayAlert | null {
  const replay = useReplay();
  return replay.open && replay.arrived > 0 && !replay.dismissed ? REPLAY[replay.arrived - 1] : null;
}
