import { getCouncilEvents } from "@/lib/api-client";
import { backendFailure } from "@/lib/api-route";

/** The run's events after a sequence number, and its status, for the replay's live tail. */
export async function GET(request: Request, ctx: RouteContext<"/api/council/runs/[id]/events">) {
  const { id } = await ctx.params;
  const runId = Number.parseInt(id, 10);
  const after = Number.parseInt(new URL(request.url).searchParams.get("after") ?? "-1", 10);
  if (!Number.isInteger(runId) || runId <= 0) return Response.json({ error: "no such council run" }, { status: 404 });
  try {
    const page = await getCouncilEvents(runId, Number.isInteger(after) ? Math.max(-1, after) : -1);
    if (!page) return Response.json({ error: "no such council run" }, { status: 404 });
    return Response.json(page);
  } catch (error) {
    return backendFailure("read a council run's events", error);
  }
}
