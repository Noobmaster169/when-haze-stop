import { z } from "zod";

/**
 * Alerts: who asked to hear about a station, and what there was to say.
 *
 * Re-exported from contracts.ts and mirrored by hand in
 * frontend/lib/api/alert-schemas.ts.
 */

/** `observed`: a reading crossed a line. `arriving`: the forecast says it will. `clearing`: it says it will drop back. */
export const AlertKind = z.enum(["observed", "arriving", "clearing"]);
export type AlertKind = z.infer<typeof AlertKind>;

export const AlertEvent = z.object({
  id: z.number().int(),
  stationId: z.string(),
  stationName: z.string(),
  kind: AlertKind,
  threshold: z.number().int(),
  /** One or two sentences: what happened and what it means. */
  message: z.string(),
  createdAt: z.string(),
});
export type AlertEvent = z.infer<typeof AlertEvent>;

export const AlertFeed = z.object({ events: z.array(AlertEvent) });
export type AlertFeed = z.infer<typeof AlertFeed>;

/** A browser's Web Push subscription, as `PushManager.subscribe()` hands it over. */
export const PushSubscription = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});
export type PushSubscription = z.infer<typeof PushSubscription>;

export const NewSubscription = z.object({
  /** Made up by the browser and kept in its storage. There is no login behind it. */
  sessionId: z.string().min(8).max(80),
  stationId: z.string().min(1).max(40),
  push: PushSubscription.optional(),
});
export type NewSubscription = z.infer<typeof NewSubscription>;

export const Subscription = z.object({
  id: z.uuid(),
  stationId: z.string(),
  stationName: z.string(),
  createdAt: z.string(),
});
export type Subscription = z.infer<typeof Subscription>;

export const SubscriptionList = z.object({ subscriptions: z.array(Subscription) });
export type SubscriptionList = z.infer<typeof SubscriptionList>;
