import { unstable_rethrow } from "next/navigation";

import { CouncilExperience, type View } from "@/components/council/council-experience";
import { getCouncilEvents, getCouncilRun, getCouncilRuns } from "@/lib/api-client";
import type { CouncilEvent, CouncilRun, CouncilRunSummary } from "@/lib/api/council-schemas";

/**
 * The Suppression Council: convene it, replay a meeting, read its verdict.
 * The newest run (or the one in the address) is read here with its events, so
 * a replay starts without a round trip; a live run's tail is polled by the
 * browser.
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
  const query = await searchParams;
  const wanted = Number.parseInt(String(query.run ?? ""), 10);
  const loaded = await load(Number.isInteger(wanted) && wanted > 0 ? wanted : null);
  const asked = query.view === "replay" || query.view === "verdict" ? query.view : "start";
  const view: View = asked === "verdict" && !loaded?.run?.verdict ? (loaded?.run ? "replay" : "start") : loaded?.run ? asked : "start";

  if (!loaded) {
    return (
      <main className="flex min-w-0 grow flex-col px-6 pt-20 md:px-10">
        <h1 className="font-display text-display-lg text-ink">Suppression Council</h1>
        <p className="mt-3 text-small text-fault">The backend could not be reached, so the council cannot be convened or replayed right now.</p>
      </main>
    );
  }
  return <CouncilExperience key={loaded.run?.id ?? "none"} runs={loaded.runs} run={loaded.run} events={loaded.events} initialView={view} />;
}
