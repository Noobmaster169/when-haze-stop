import { unstable_rethrow } from "next/navigation";

import { FetchLog } from "@/components/sources/fetch-log";
import { SourceCard } from "@/components/sources/source-card";
import { getSources } from "@/lib/api-client";
import type { SourceReport } from "@/lib/api/source-schemas";

/** Every outside source the app reads, when the hourly job last fetched it, and what came back. */

async function load(): Promise<SourceReport | null> {
  try {
    return await getSources();
  } catch (error) {
    // Next signals "render this per request" by throwing; that is not a backend failure.
    unstable_rethrow(error);
    console.error("[sources] the backend could not be read:", error);
    return null;
  }
}

export default async function SourcesPage() {
  const report = await load();
  const now = new Date();
  const section = "mt-10 text-title font-medium text-ink";
  const prose = "mt-2 max-w-[68ch] text-body text-ink-secondary";
  const names = new Map(report?.sources.map((source) => [source.id, source.name]) ?? []);

  return (
    <main className="flex min-w-0 grow flex-col">
      <div className="min-h-0 grow overflow-y-auto px-6 py-8 md:px-10">
        <h1 className="font-display text-display text-ink">Sources</h1>
        <p className={prose}>
          Every number in this app comes from one of these. The hourly job fetches them and keeps a record of each fetch: when it ran, how long it took, and what came back or why it failed. Times are UTC.
        </p>

        {report === null ? <p className="mt-4 text-small text-fault">The backend could not be reached.</p> : null}
        {report ? (
          <div className="mt-6 grid max-w-[1100px] gap-3 lg:grid-cols-2">
            {report.sources.map((source) => (
              <SourceCard key={source.id} source={source} now={now} />
            ))}
          </div>
        ) : null}

        <h2 className={section}>Recent fetches</h2>
        {report && report.recent.length === 0 ? <p className={prose}>Nothing has been fetched yet. The first fetch happens when the hourly job starts.</p> : null}
        {report && report.recent.length > 0 ? (
          <div className="mt-3 max-w-[1100px] pb-6">
            <FetchLog fetches={report.recent} names={names} />
          </div>
        ) : null}
      </div>
    </main>
  );
}
