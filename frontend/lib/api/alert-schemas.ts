import { z } from "zod";

import { DayOutlook } from "./haze-schemas";
import { Statement } from "./statement-schemas";

/** The alerts contract, mirrored by hand from backend/src/contracts.alerts.ts. */

export const AlertKind = z.enum(["observed", "arriving", "clearing", "order"]);
export type AlertKind = z.infer<typeof AlertKind>;

export const AlertEvent = z.object({
  id: z.number().int(),
  stationId: z.string(),
  stationName: z.string(),
  kind: AlertKind,
  threshold: z.number().int(),
  message: z.string(),
  open: z.boolean(),
  createdAt: z.string(),
});
export type AlertEvent = z.infer<typeof AlertEvent>;

export const AlertFeed = z.object({ events: z.array(AlertEvent) });
export type AlertFeed = z.infer<typeof AlertFeed>;

export const Subscription = z.object({ id: z.uuid(), stationId: z.string(), stationName: z.string(), createdAt: z.string() });
export type Subscription = z.infer<typeof Subscription>;

export const SubscriptionList = z.object({ subscriptions: z.array(Subscription) });
export type SubscriptionList = z.infer<typeof SubscriptionList>;

export const PushSubscription = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});
export type PushSubscription = z.infer<typeof PushSubscription>;

export const PushKey = z.object({ publicKey: z.string().nullable() });
export type PushKey = z.infer<typeof PushKey>;

export const HeadlineTone = z.enum(["order", "close", "clear", "watch", "calm"]);
export type HeadlineTone = z.infer<typeof HeadlineTone>;

export const Headline = z.object({ tone: HeadlineTone, title: z.string(), sentence: z.string() });
export type Headline = z.infer<typeof Headline>;

export const AreaCard = z.object({
  stationId: z.string(),
  stationName: z.string(),
  state: z.string(),
  api: z.number().int().nullable(),
  observedAt: z.string().nullable(),
  headline: Headline,
  days: z.array(DayOutlook),
  alert: AlertEvent.nullable(),
  orders: z.array(Statement),
});
export type AreaCard = z.infer<typeof AreaCard>;

export const AreaList = z.object({ areas: z.array(AreaCard) });
export type AreaList = z.infer<typeof AreaList>;
