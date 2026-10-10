import { setPush } from "@/lib/api-client";
import { PushSubscription } from "@/lib/api/alert-schemas";
import { backendFailure } from "@/lib/api-route";

/** Where a browser's alerts are sent, or null to stop. */
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { sessionId?: unknown; push?: unknown };
    const push = body.push === null ? null : PushSubscription.safeParse(body.push);
    if (typeof body.sessionId !== "string" || (push !== null && !push.success)) {
      return Response.json({ error: "Turning notifications on needs a session and the browser's push subscription." }, { status: 400 });
    }
    const outcome = await setPush(body.sessionId, push === null ? null : push.data);
    if (!outcome.ok) return Response.json({ error: outcome.message }, { status: 502 });
    return new Response(null, { status: 204 });
  } catch (error) {
    return backendFailure("set where alerts are sent", error);
  }
}
