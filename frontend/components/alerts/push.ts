"use client";

import { PushKey } from "@/lib/api/alert-schemas";

/**
 * Notifications on this device. The browser makes a push subscription with
 * the server's public key; the api keeps it beside what this browser follows,
 * and the jobs process sends each new alert to it.
 */

export type PushState = "unsupported" | "unavailable" | "blocked" | "off" | "on";

const WORKER = "/sw.js";

function supported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** The key the server signs with, as the bytes PushManager wants. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

async function serverKey(): Promise<string | null> {
  const response = await fetch("/api/alerts/push-key");
  if (!response.ok) return null;
  return PushKey.parse(await response.json()).publicKey;
}

async function register(session: string, push: PushSubscriptionJSON | null): Promise<boolean> {
  const response = await fetch("/api/alerts/push", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: session, push }) });
  return response.ok;
}

export async function pushState(): Promise<PushState> {
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const registration = await navigator.serviceWorker.getRegistration(WORKER);
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? "on" : "off";
}

/** Asks the person, subscribes, and tells the api where to send. */
export async function turnOn(session: string): Promise<PushState> {
  if (!supported()) return "unsupported";
  const key = await serverKey();
  if (!key) return "unavailable";
  if ((await Notification.requestPermission()) !== "granted") return "blocked";
  const registration = await navigator.serviceWorker.register(WORKER);
  await navigator.serviceWorker.ready;
  const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
  return (await register(session, subscription.toJSON())) ? "on" : "off";
}

/** Same subscription again, so an area followed after notifications were turned on is sent to as well. */
export async function refreshPush(session: string): Promise<void> {
  if (!supported()) return;
  const registration = await navigator.serviceWorker.getRegistration(WORKER);
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) await register(session, subscription.toJSON());
}

export async function turnOff(session: string): Promise<PushState> {
  const registration = await navigator.serviceWorker.getRegistration(WORKER);
  await (await registration?.pushManager.getSubscription())?.unsubscribe();
  await register(session, null);
  return "off";
}
