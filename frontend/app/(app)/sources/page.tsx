import { unstable_rethrow } from "next/navigation";

import { DATASETS } from "@/components/sources/datasets";
import { DatasetSection } from "@/components/sources/dataset-section";
import { STATE_TONE, worstState } from "@/components/sources/source-state";
import { SourcesToc, type TocGroup } from "@/components/sources/sources-toc";
import { WhereTable } from "@/components/sources/where-table";
import { getSourceFetches, getSources } from "@/lib/api-client";
import type { SourceFetchPage, SourceReport } from "@/lib/api/source-schemas";

/** The data the hourly job fetches, one section per kind, then who publishes it, with contents beside. */

const SCROLL_ID = "sources-scroll";

async function orNull<T>(what: string, read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    // Next signals "render this per request" by throwing; that is not a backend failure.
    unstable_rethrow(error);
    console.error(`[sources] ${what} could not be read:`, error);
    return null;
  }
}

function pageNumber(value: string | string[] | undefined): number {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page > 1 ? page : 1;
}

function contents(report: SourceReport, now: Date): TocGroup[] {
  return [
    {
      label: "Data fetched",
      items: DATASETS.map((dataset) => {
        const tone = STATE_TONE[worstState(report.sources.filter((source) => dataset.members.includes(source.id)), now)];
        return { id: `section-${dataset.key}`, label: dataset.title, icon: dataset.icon, status: { dot: tone.dot, label: tone.label } };
      }),
    },
    { label: "Reference", items: [{ id: "section-where", label: "Where it comes from", icon: "external", status: null }] },
  ];
}

export default async function SourcesPage({ searchParams }: PageProps<"/sources">) {
  const query = await searchParams;
  const params: Record<string, string> = {};
  for (const dataset of DATASETS) {
    const page = pageNumber(query[dataset.key]);
    if (page > 1) params[dataset.key] = String(page);
  }

  const [report, ...pages] = await Promise.all([
    orNull<SourceReport>("the sources", getSources),
    ...DATASETS.map((dataset) => orNull<SourceFetchPage>(`the ${dataset.key} history`, () => getSourceFetches(dataset.history, pageNumber(params[dataset.key])))),
  ]);
  const now = new Date();
  const groups = report ? contents(report, now) : [];

  return (
    <main className="flex min-w-0 grow flex-col">
      <div id={SCROLL_ID} className="relative min-h-0 grow overflow-y-auto px-6 pb-8 motion-safe:scroll-smooth md:px-10">
        <div className="flex max-w-[1180px] gap-12">
          {report ? (
            <aside className="hidden w-52 shrink-0 lg:block">
              <div className="sticky top-0 pt-36">
                <SourcesToc groups={groups} rootId={SCROLL_ID} layout="column" />
              </div>
            </aside>
          ) : null}

          <div className="min-w-0 max-w-[920px] grow">
            <header className="pt-20 pb-6">
              <h1 className="font-display text-display text-ink">Sources</h1>
              <p className="mt-2 max-w-[62ch] text-body text-ink-secondary">
                Four kinds of data feed the map and the alerts, each fetched on a schedule. Times are Malaysian time.
              </p>
            </header>

            {report === null ? (
              <p className="text-small text-fault">The backend could not be reached.</p>
            ) : (
              <>
                <div className="sticky top-14 z-10 lg:hidden">
                  <SourcesToc groups={groups} rootId={SCROLL_ID} layout="bar" />
                </div>
                <div>
                  {DATASETS.map((dataset, index) => (
                    <DatasetSection key={dataset.key} dataset={dataset} sources={report.sources} page={pages[index]} params={params} now={now} />
                  ))}
                </div>
                <section id="section-where" aria-labelledby="where" className="scroll-mt-16 border-t border-hairline py-8 lg:scroll-mt-4">
                  <h2 id="where" className="font-display text-[22px] leading-7 text-ink">
                    Where it comes from
                  </h2>
                  <p className="mt-1 mb-4 max-w-[62ch] text-body text-ink-secondary">All public, no key needed.</p>
                  <WhereTable sources={report.sources} />
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
