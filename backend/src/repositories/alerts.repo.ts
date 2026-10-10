import { randomUUID } from "node:crypto";

import type { AlertEvent, AlertKind, PushSubscription, Subscription } from "../contracts";
import type { Queryable } from "../db";

/** Who asked to hear about a station, and what has been said. */

interface EventRow {
  id: string;
  station_id: string;
  station_name: string;
  kind: AlertKind;
  threshold: number;
  message: string;
  created_at: Date;
}

const EVENT = "e.id, e.station_id, s.name as station_name, e.kind, e.threshold, e.message, e.created_at";

function toEvent(row: EventRow): AlertEvent {
  return {
    id: Number(row.id),
    stationId: row.station_id,
    stationName: row.station_name,
    kind: row.kind,
    threshold: row.threshold,
    message: row.message,
    createdAt: row.created_at.toISOString(),
  };
}

export interface OpenAlert {
  id: number;
  stationId: string;
  kind: AlertKind;
  threshold: number;
}

export async function openAlerts(db: Queryable): Promise<OpenAlert[]> {
  const { rows } = await db.query<{ id: string; station_id: string; kind: AlertKind; threshold: number }>(
    "select id, station_id, kind, threshold from alert_events where open",
  );
  return rows.map((row) => ({ id: Number(row.id), stationId: row.station_id, kind: row.kind, threshold: row.threshold }));
}

export interface NewAlert {
  stationId: string;
  kind: AlertKind;
  threshold: number;
  message: string;
  detail: Record<string, unknown>;
}

/** Opens an alert unless the same one is already open, which the unique index decides. Returns whether it was new. */
export async function open(db: Queryable, alert: NewAlert): Promise<boolean> {
  const { rowCount } = await db.query(
    `insert into alert_events (station_id, kind, threshold, message, detail) values ($1, $2, $3, $4, $5)
     on conflict (station_id, kind, threshold) where open do nothing`,
    [alert.stationId, alert.kind, alert.threshold, alert.message, JSON.stringify(alert.detail)],
  );
  return (rowCount ?? 0) > 0;
}

/** The condition behind these no longer holds, so the same alert may be raised again later. */
export async function close(db: Queryable, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db.query("update alert_events set open = false where id = any($1)", [ids]);
}

/** The open alert of each of these stations, at most one each since only one is raised at a time. */
export async function openEvents(db: Queryable, stationIds: string[]): Promise<AlertEvent[]> {
  if (stationIds.length === 0) return [];
  const { rows } = await db.query<EventRow>(
    `select ${EVENT} from alert_events e join stations s on s.id = e.station_id
      where e.open and e.kind <> 'observed' and e.station_id = any($1) order by e.id desc`,
    [stationIds],
  );
  return rows.map(toEvent);
}

export interface PushTarget {
  sessionId: string;
  stationId: string;
  push: PushSubscription;
}

/** The devices that asked to be notified about these stations. */
export async function pushTargets(db: Queryable, stationIds: string[]): Promise<PushTarget[]> {
  if (stationIds.length === 0) return [];
  const { rows } = await db.query<{ session_id: string; station_id: string; push: PushSubscription }>(
    "select session_id, station_id, push from alert_subscriptions where push is not null and station_id = any($1)",
    [stationIds],
  );
  return rows.map((row) => ({ sessionId: row.session_id, stationId: row.station_id, push: row.push }));
}

/**
 * Sets the device a session notifies, on every area it follows; null turns it
 * off. A push subscription is the browser's, so it is the same for all of them.
 */
export async function setPush(db: Queryable, sessionId: string, push: PushSubscription | null): Promise<void> {
  await db.query("update alert_subscriptions set push = $2 where session_id = $1", [sessionId, push ? JSON.stringify(push) : null]);
}

/** The push service said this device is gone. */
export async function forgetPush(db: Queryable, endpoint: string): Promise<void> {
  await db.query("update alert_subscriptions set push = null where push->>'endpoint' = $1", [endpoint]);
}

/** Newest first. With a session, only the stations it follows; without one, every station. */
export async function feed(db: Queryable, options: { sessionId?: string; afterId?: number; limit?: number }): Promise<AlertEvent[]> {
  const { rows } = await db.query<EventRow>(
    `select ${EVENT} from alert_events e join stations s on s.id = e.station_id
      where e.id > $1
        and ($2::text is null or e.station_id in (select station_id from alert_subscriptions where session_id = $2))
      order by e.id desc limit $3`,
    [options.afterId ?? 0, options.sessionId ?? null, options.limit ?? 30],
  );
  return rows.map(toEvent);
}

interface SubscriptionRow {
  id: string;
  station_id: string;
  station_name: string;
  created_at: Date;
}

function toSubscription(row: SubscriptionRow): Subscription {
  return { id: row.id, stationId: row.station_id, stationName: row.station_name, createdAt: row.created_at.toISOString() };
}

const SUBSCRIPTION = "a.id, a.station_id, s.name as station_name, a.created_at";

/** Following a station twice is following it once. */
export async function subscribe(db: Queryable, sessionId: string, stationId: string, push?: PushSubscription): Promise<Subscription> {
  const { rows } = await db.query<SubscriptionRow>(
    `with a as (
       insert into alert_subscriptions (id, session_id, station_id, push) values ($1, $2, $3, $4)
       on conflict (session_id, station_id) do update set push = coalesce(excluded.push, alert_subscriptions.push)
       returning id, station_id, created_at
     )
     select ${SUBSCRIPTION} from a join stations s on s.id = a.station_id`,
    [randomUUID(), sessionId, stationId, push ? JSON.stringify(push) : null],
  );
  return toSubscription(rows[0]);
}

export async function subscriptions(db: Queryable, sessionId: string): Promise<Subscription[]> {
  const { rows } = await db.query<SubscriptionRow>(
    `select ${SUBSCRIPTION} from alert_subscriptions a join stations s on s.id = a.station_id where a.session_id = $1 order by a.created_at`,
    [sessionId],
  );
  return rows.map(toSubscription);
}

export async function unsubscribe(db: Queryable, sessionId: string, stationId: string): Promise<boolean> {
  const { rowCount } = await db.query("delete from alert_subscriptions where session_id = $1 and station_id = $2", [sessionId, stationId]);
  return (rowCount ?? 0) > 0;
}
