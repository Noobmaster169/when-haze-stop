import { unfollow } from "@/lib/api-client";
import { backendFailure } from "@/lib/api-route";

export async function DELETE(request: Request, ctx: RouteContext<"/api/alerts/subscriptions/[stationId]">) {
  const { stationId } = await ctx.params;
  const session = new URL(request.url).searchParams.get("session") ?? "";
  try {
    const outcome = await unfollow(session, stationId);
    if (!outcome.ok) return Response.json({ error: outcome.message }, { status: 502 });
    return new Response(null, { status: 204 });
  } catch (error) {
    return backendFailure("stop following a station", error);
  }
}
