import type { ModelLive } from "@/lib/api/model-schemas";

import { Ledger } from "./ledger";
import { LiveTiles } from "./live-tiles";
import { Watch } from "./watch";

/**
 * The live record: the backtest, the running score and the rule's state as
 * three tiles, the stations the model expects to be worst tomorrow, and the
 * ledger of every forecast scored since. The page mounts it as its first
 * chapter; what it shows is read from the database on each visit.
 */
export function LiveChapter({ live }: { live: ModelLive }) {
  return (
    <div className="space-y-6">
      <LiveTiles source={live.source} skill={live.skill} nextCheckAt={live.nextCheckAt} />
      <section>
        <h3 className="text-small font-medium text-ink">Watching it now</h3>
        <p className="mt-0.5 mb-3 max-w-[68ch] text-caption text-ink-tertiary">The stations the newest issue puts highest tomorrow, and any you follow: the week&apos;s readings, the forecast, and each coming day&apos;s band.</p>
        <Watch watch={live.watch} />
      </section>
      <section>
        <h3 className="text-small font-medium text-ink">The ledger</h3>
        <p className="mt-0.5 mb-3 max-w-[68ch] text-caption text-ink-tertiary">Every learned forecast scored once its day passed, newest issue first.</p>
        <Ledger ledger={live.ledger} />
      </section>
    </div>
  );
}
