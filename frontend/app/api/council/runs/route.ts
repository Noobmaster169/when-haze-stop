import { getCouncilRuns, startCouncilRun } from "@/lib/api-client";
import { backendFailure, passRead } from "@/lib/api-route";
import { BudgetChoice, DEFAULT_BUDGET_RM } from "@/lib/api/council-schemas";

/** Every council run, newest first, without their verdicts. */
export async function GET() {
  return passRead("list council runs", async () => ({ runs: await getCouncilRuns() }));
}

/** Convene the council. A run already going is answered as that run, attached, rather than refused. */
export async function POST(request: Request) {
  // An empty or unreadable body means the default budget, not a failure.
  const body: unknown = await request.json().catch(() => ({}));
  const budget = BudgetChoice.safeParse(typeof body === "object" && body !== null && "budgetRm" in body ? body.budgetRm : DEFAULT_BUDGET_RM);
  if (!budget.success) return Response.json({ error: "The budget must be RM 4, 8 or 12 million." }, { status: 400 });
  try {
    const outcome = await startCouncilRun(budget.data);
    if (!outcome.ok) return Response.json({ error: outcome.message }, { status: outcome.status === 409 ? 409 : 502 });
    return Response.json(outcome.value, { status: outcome.value.attached ? 200 : 202 });
  } catch (error) {
    return backendFailure("convene the council", error);
  }
}
