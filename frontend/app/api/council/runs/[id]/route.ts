import { deleteCouncilRun, getCouncilRun } from "@/lib/api-client";
import { backendFailure } from "@/lib/api-route";

function runIdOf(id: string): number | null {
  const runId = Number.parseInt(id, 10);
  return Number.isInteger(runId) && runId > 0 ? runId : null;
}

/** One run with its verdict once it has one. */
export async function GET(_request: Request, ctx: RouteContext<"/api/council/runs/[id]">) {
  const runId = runIdOf((await ctx.params).id);
  if (runId === null) return Response.json({ error: "no such council run" }, { status: 404 });
  try {
    const run = await getCouncilRun(runId);
    if (!run) return Response.json({ error: "no such council run" }, { status: 404 });
    return Response.json(run);
  } catch (error) {
    return backendFailure("read a council run", error);
  }
}

/** Deletes a finished or failed run. The backend's 404 and 409 (a meeting in session) pass through with its message. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/council/runs/[id]">) {
  const runId = runIdOf((await ctx.params).id);
  if (runId === null) return Response.json({ error: "no such council run" }, { status: 404 });
  try {
    const outcome = await deleteCouncilRun(runId);
    if (outcome.ok) return new Response(null, { status: 204 });
    return Response.json({ error: outcome.message }, { status: outcome.status === 404 || outcome.status === 409 ? outcome.status : 502 });
  } catch (error) {
    return backendFailure("delete a council run", error);
  }
}
