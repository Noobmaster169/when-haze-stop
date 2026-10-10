import { z } from "zod";

import { DayOutlook } from "./contracts.haze";
import { Statement } from "./contracts.statements";

/**
 * Alerts: who asked to hear about a station, and what there was to say.
 *
 * Re-exported from contracts.ts and mirrored by hand in
 * frontend/lib/api/alert-schemas.ts.
 */

/**
 * `arriving`: the forecast says a closing line will be passed. `order`: an
 * official order covers the area. `clearing`: the forecast says it will drop
 * back. `observed` (a reading crossed a line) is no longer raised and stays
 * for the alerts said before 10 October 2026.
 */
export const AlertKind = z.enum(["observed", "arriving", "clearing", "order"]);
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

export const PushRegistration = z.object({
  sessionId: z.string().min(8).max(80),
  /** Null when the person turned notifications off. */
  push: PushSubscription.nullable(),
});
export type PushRegistration = z.infer<typeof PushRegistration>;

/** The VAPID public key a browser subscribes with, or null when this server sends no push. */
export const PushKey = z.object({ publicKey: z.string().nullable() });
export type PushKey = z.infer<typeof PushKey>;

/** `order` and `close`: schools shut or may shut. `clear`: it is easing. `watch`: unhealthy but no action due. `calm`: nothing expected. */
export const HeadlineTone = z.enum(["order", "close", "clear", "watch", "calm"]);
export type HeadlineTone = z.infer<typeof HeadlineTone>;

/** What a followed area's card leads with: always the forecast, or the order in force. */
export const Headline = z.object({
  tone: HeadlineTone,
  /** A few words: "Schools may close tomorrow". */
  title: z.string(),
  /** One sentence behind it. */
  sentence: z.string(),
});
export type Headline = z.infer<typeof Headline>;

export const AreaCard = z.object({
  stationId: z.string(),
  stationName: z.string(),
  state: z.string(),
  api: z.number().int().nullable(),
  observedAt: z.string().nullable(),
  headline: Headline,
  /** Today first. Empty before the model has run. */
  days: z.array(DayOutlook),
  /** The open alert for this area, if one is. */
  alert: AlertEvent.nullable(),
  /** Official orders in force or about to be that cover this area. */
  orders: z.array(Statement),
});
export type AreaCard = z.infer<typeof AreaCard>;

export const AreaList = z.object({ areas: z.array(AreaCard) });
export type AreaList = z.infer<typeof AreaList>;
