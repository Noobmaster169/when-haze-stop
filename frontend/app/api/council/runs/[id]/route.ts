import { getCouncilRun } from "@/lib/api-client";
import { backendFailure } from "@/lib/api-route";

/** One run with its verdict once it has one. */
export async function GET(_request: Request, ctx: RouteContext<"/api/council/runs/[id]">) {
  const { id } = await ctx.params;
  const runId = Number.parseInt(id, 10);
  if (!Number.isInteger(runId) || runId <= 0) return Response.json({ error: "no such council run" }, { status: 404 });
  try {
    const run = await getCouncilRun(runId);
    if (!run) return Response.json({ error: "no such council run" }, { status: 404 });
    return Response.json(run);
  } catch (error) {
    return backendFailure("read a council run", error);
  }
}
