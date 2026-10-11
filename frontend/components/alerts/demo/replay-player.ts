"use client";

import { useSyncExternalStore } from "react";

import { clampStep, LAST_STEP, REPLAY_STEPS, type ReplayAlert } from "./replay";

/**
 * Steps through the replay at the presenter's pace. An alert step slides the
 * alert in at the top right, as the live one does, and shows it on this device
 * when notifications are already allowed. Held in this tab only; nothing is
 * sent to the api, and the replay never asks for a permission.
 */

/** 0 is no replay; 1 to LAST_STEP is the moment showing. */
let step = 0;
const listeners = new Set<() => void>();

function go(next: number): void {
  step = next;
  for (const listener of listeners) listener();
  const alert = REPLAY_STEPS[step - 1]?.alert;
  if (alert) void notifyDevice(alert);
}

async function notifyDevice(alert: ReplayAlert): Promise<void> {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || Notification.permission !== "granted") return;
  try {
    const registration = (await navigator.serviceWorker.getRegistration("/sw.js")) ?? (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    await registration.showNotification(alert.title, { body: `${alert.message} Replay of 8 Oct.`, tag: `replay-${alert.kind}`, data: { url: "/alerts" } });
  } catch (error) {
    // The toast still shows; only the copy on the device is missing.
    console.warn("[replay] the device notification was not shown:", error);
  }
}

export function startReplay(): void {
  go(1);
}

/** Past the last step, the replay ends. */
export function nextStep(): void {
  go(step >= LAST_STEP ? 0 : clampStep(step + 1));
}

export function previousStep(): void {
  if (step > 1) go(step - 1);
}

export function stopReplay(): void {
  go(0);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useReplayStep(): number {
  return useSyncExternalStore(
    subscribe,
    () => step,
    () => 0,
  );
}
