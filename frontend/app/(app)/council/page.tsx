import { redirect, unstable_rethrow } from "next/navigation";

import { CouncilExperience } from "@/components/council/council-experience";
import { parsePlace, resolvePlace } from "@/components/council/route-state";
import { getCouncilEvents, getCouncilRun, getCouncilRuns } from "@/lib/api-client";
import type { CouncilEvent, CouncilRun, CouncilRunSummary } from "@/lib/api/council-schemas";

/**
 * The Suppression Council: convene it, replay a meeting, read its verdict.
 * The address says which run and which view (components/council/route-state.ts
 * has the table); this page reads that run with its events on every
 * navigation, so a replay starts without a round trip, and a live run's tail
 * is then polled by the browser.
 */

interface Loaded {
  runs: CouncilRunSummary[];
  run: CouncilRun | null;
  events: CouncilEvent[];
}

async function load(wanted: number | null): Promise<Loaded | null> {
  try {
    const runs = await getCouncilRuns();
    const id = wanted ?? runs[0]?.id ?? null;
    if (id === null) return { runs, run: null, events: [] };
    const [run, page] = await Promise.all([getCouncilRun(id), getCouncilEvents(id, -1)]);
    return { runs, run, events: page?.events ?? [] };
  } catch (error) {
    // Next signals "render this per request" by throwing; that is not a backend failure.
    unstable_rethrow(error);
    console.error("[council] the backend could not be read:", error);
    return null;
  }
}

export default async function CouncilPage({ searchParams }: PageProps<"/council">) {
  const asked = parsePlace(await searchParams);
  const loaded = await load(asked.runId);
  if (!loaded) {
    return (
      <main className="flex min-w-0 grow flex-col px-6 pt-20 md:px-10">
        <h1 className="font-display text-display-lg text-ink">Suppression Council</h1>
        <p className="mt-3 text-small text-fault">The backend could not be reached, so the council cannot be convened or replayed right now.</p>
      </main>
    );
  }
  const facts = loaded.run ? { status: loaded.run.status, hasVerdict: loaded.run.verdict !== null } : null;
  const { shown, replaceWith, missing } = resolvePlace(asked, loaded.runs[0]?.id ?? null, facts);
  // Outside load's try: a redirect is Next's control flow, thrown on purpose.
  if (replaceWith) redirect(replaceWith);
  return (
    <CouncilExperience
      key={loaded.run?.id ?? "none"}
      runs={loaded.runs}
      run={missing ? null : loaded.run}
      events={missing ? [] : loaded.events}
      view={shown.view}
      named={asked.runId !== null && !missing}
      missingRun={missing ? asked.runId : null}
    />
  );
}
