import { getCouncilRuns, startCouncilRun } from "@/lib/api-client";
import { backendFailure, passRead } from "@/lib/api-route";

/** Every council run, newest first, without their verdicts. */
export async function GET() {
  return passRead("list council runs", async () => ({ runs: await getCouncilRuns() }));
}

/** Convene the council. A run already going is answered as that run, attached, rather than refused. */
export async function POST() {
  try {
    const outcome = await startCouncilRun();
    if (!outcome.ok) return Response.json({ error: outcome.message }, { status: outcome.status === 409 ? 409 : 502 });
    return Response.json(outcome.value, { status: outcome.value.attached ? 200 : 202 });
  } catch (error) {
    return backendFailure("convene the council", error);
  }
}
