import { follow, getSubscriptions } from "@/lib/api-client";
import { backendFailure, passRead } from "@/lib/api-route";

/** The stations a browser follows. */
export async function GET(request: Request) {
  const session = new URL(request.url).searchParams.get("session") ?? "";
  if (session.length < 8) return Response.json({ subscriptions: [] });
  return passRead("read followed stations", () => getSubscriptions(session));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sessionId?: unknown; stationId?: unknown };
    if (typeof body.sessionId !== "string" || typeof body.stationId !== "string") {
      return Response.json({ error: "Following a station needs a session and a station." }, { status: 400 });
    }
    const outcome = await follow(body.sessionId, body.stationId);
    if (!outcome.ok) return Response.json({ error: outcome.message }, { status: 502 });
    return Response.json(outcome.value, { status: 201 });
  } catch (error) {
    return backendFailure("follow a station", error);
  }
}
