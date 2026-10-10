import { AlertFeed, Subscription, SubscriptionList } from "./alert-schemas";
import type { Outcome } from "./chat-client";
import { get, parseAs, refusalMessage, request } from "./transport";

/** Without a session, every station's alerts; with one, only the stations that browser follows. */
export async function getAlerts(options: { session?: string; after?: number }): Promise<AlertFeed> {
  const query = new URLSearchParams();
  if (options.session) query.set("session", options.session);
  if (options.after) query.set("after", String(options.after));
  return get(AlertFeed, `/alerts?${query.toString()}`);
}

export async function getSubscriptions(session: string): Promise<SubscriptionList> {
  return get(SubscriptionList, `/alerts/subscriptions?session=${encodeURIComponent(session)}`);
}

export async function follow(session: string, stationId: string): Promise<Outcome<Subscription>> {
  const response = await request("/alerts/subscriptions", { method: "POST", body: JSON.stringify({ sessionId: session, stationId }) });
  if (!response.ok) return { ok: false, message: await refusalMessage(response) };
  return { ok: true, value: await parseAs(Subscription, response, "POST /alerts/subscriptions") };
}

export async function unfollow(session: string, stationId: string): Promise<Outcome<null>> {
  const response = await request(`/alerts/subscriptions/${encodeURIComponent(stationId)}?session=${encodeURIComponent(session)}`, { method: "DELETE" });
  // Not following it already is the state that was asked for.
  if (!response.ok && response.status !== 404) return { ok: false, message: await refusalMessage(response) };
  return { ok: true, value: null };
}
