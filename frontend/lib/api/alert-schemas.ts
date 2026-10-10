import { z } from "zod";

/** The alerts contract, mirrored by hand from backend/src/contracts.alerts.ts. */

export const AlertKind = z.enum(["observed", "arriving", "clearing"]);
export type AlertKind = z.infer<typeof AlertKind>;

export const AlertEvent = z.object({
  id: z.number().int(),
  stationId: z.string(),
  stationName: z.string(),
  kind: AlertKind,
  threshold: z.number().int(),
  message: z.string(),
  createdAt: z.string(),
});
export type AlertEvent = z.infer<typeof AlertEvent>;

export const AlertFeed = z.object({ events: z.array(AlertEvent) });
export type AlertFeed = z.infer<typeof AlertFeed>;

export const Subscription = z.object({ id: z.uuid(), stationId: z.string(), stationName: z.string(), createdAt: z.string() });
export type Subscription = z.infer<typeof Subscription>;

export const SubscriptionList = z.object({ subscriptions: z.array(Subscription) });
export type SubscriptionList = z.infer<typeof SubscriptionList>;
