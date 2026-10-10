import { CouncilEventPage, CouncilRun, CouncilRunList, CouncilRunSummary, type CouncilStart } from "./council-schemas";
import { BackendError, get, parseAs, refusalMessage, request } from "./transport";

/**
 * The Suppression Council: start a run, list runs, read one and its event log.
 * A run takes many minutes in the jobs worker; these calls only queue it and
 * read what it has written so far.
 */

export type CouncilOutcome<T> = { ok: true; value: T } | { ok: false; status: number; message: string };

export async function getCouncilRuns(): Promise<CouncilRunSummary[]> {
  return (await get(CouncilRunList, "/council/runs")).runs;
}

/** Null for a run the backend does not hold, so the page can say so rather than fail. */
export async function getCouncilRun(id: number): Promise<CouncilRun | null> {
  try {
    return await get(CouncilRun, `/council/runs/${id}`);
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return null;
    throw error;
  }
}

export async function getCouncilEvents(id: number, after: number): Promise<CouncilEventPage | null> {
  try {
    return await get(CouncilEventPage, `/council/runs/${id}/events?after=${after}`);
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Queues a run for Kuala Lumpur and surroundings. One run at a time: when one is
 * already queued or running, the answer is that run, marked as attached, so a
 * second press follows the meeting already under way instead of failing.
 */
export async function startCouncilRun(): Promise<CouncilOutcome<CouncilStart>> {
  const response = await request("/council/runs", { method: "POST", body: JSON.stringify({ target: "klang-valley" }) });
  if (response.status === 409) {
    const message = await refusalMessage(response);
    const going = (await getCouncilRuns()).find((run) => run.status === "queued" || run.status === "running");
    if (!going) return { ok: false, status: 409, message };
    return { ok: true, value: { run: going, attached: true } };
  }
  if (!response.ok) return { ok: false, status: response.status, message: await refusalMessage(response) };
  // The summary schema drops the (still empty) verdict, so a new run and an attached one look alike.
  const run = await parseAs(CouncilRunSummary, response, "POST /council/runs");
  return { ok: true, value: { run, attached: false } };
}
