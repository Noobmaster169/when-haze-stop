import { unstable_rethrow } from "next/navigation";

import { AlertsHome } from "@/components/alerts/alerts-home";
import { ReplayButton } from "@/components/alerts/demo/replay-button";
import { StatementList } from "@/components/alerts/statement-list";
import { getStatements } from "@/lib/api-client";
import type { StatementPage } from "@/lib/api/statement-schemas";

/** What was sent for the places this browser follows, each place's outlook, then what the government has said. */

async function readStatements(all: boolean, page: number): Promise<StatementPage | null> {
  try {
    return await getStatements({ current: !all, page });
  } catch (error) {
    // Next signals "render this per request" by throwing; that is not a backend failure.
    unstable_rethrow(error);
    console.error("[alerts] the statements could not be read:", error);
    return null;
  }
}

export default async function AlertsPage({ searchParams }: PageProps<"/alerts">) {
  const query = await searchParams;
  const all = query.statements === "all";
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);
  const statements = await readStatements(all, page);

  return (
    <main className="flex min-w-0 grow flex-col">
      <div className="@container relative min-h-0 grow overflow-y-auto px-6 pt-20 pb-10 motion-safe:scroll-smooth md:px-10">
        <div className="max-w-[920px]">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="min-w-0 grow">
              <h1 className="font-display text-display text-ink">Alerts</h1>
              <p className="mt-2 max-w-[62ch] text-body text-ink-secondary">What the forecast and the government say for the places you follow.</p>
            </div>
            <ReplayButton />
          </div>
          <div className="mt-8 space-y-12">
            <AlertsHome />
            <StatementList page={statements} query={{ all, page }} />
          </div>
        </div>
      </div>
    </main>
  );
}
