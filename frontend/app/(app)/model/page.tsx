import { ChangeChapter } from "@/components/model/change-chapter";
import { MODEL_CHAPTERS, MODEL_SCROLL_ID } from "@/components/model/chapters";
import { CrossingBars } from "@/components/model/crossing-bars";
import { DataChapter } from "@/components/model/data-chapter";
import { ErrorChapter } from "@/components/model/error-chapter";
import { FunctionChapter } from "@/components/model/function-chapter";
import { LimitsChapter } from "@/components/model/limits-chapter";
import { ModelChapter } from "@/components/model/model-chapter";
import { Scorecard } from "@/components/model/scorecard";
import { VerdictChapter } from "@/components/model/verdict-chapter";
import { Contents } from "@/components/simulation/contents";
import { MODEL_PERFORMANCE } from "@/lib/model-performance";

/**
 * The learned forecast, scored, as eight figures beside the Simulation page.
 * Every figure comes from the model's published report, bundled at build
 * time, so the page needs no backend and changes only when a new report is
 * committed.
 */

export default function ModelPage() {
  const data = MODEL_PERFORMANCE;
  return (
    <main className="flex min-w-0 grow flex-col">
      <div id={MODEL_SCROLL_ID} className="min-h-0 grow overflow-y-auto px-4 pt-20 pb-8 md:px-10">
        <h1 className="font-display text-display text-ink">Model</h1>
        <p className="mt-1.5 max-w-[68ch] text-body text-ink-secondary">How the learned next-day forecast scores on months it never saw, at every instrument it serves.</p>
        <p className="mt-1 font-mono text-caption text-ink-tertiary">
          Version {data.version}, tested {data.testSpan}
        </p>

        <div className="mt-6 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
          <aside className="mb-4 lg:sticky lg:top-0 lg:mb-0 lg:self-start">
            <Contents chapters={MODEL_CHAPTERS} scrollId={MODEL_SCROLL_ID} />
          </aside>

          <div className="min-w-0 max-w-[900px]">
            <DataChapter data={data} />
            <VerdictChapter data={data} />
            <FunctionChapter />
            <ErrorChapter data={data} />
            <ModelChapter id="crossings">
              <CrossingBars tallies={data.cross150} />
            </ModelChapter>
            <ChangeChapter data={data} />
            <ModelChapter id="scorecard">
              <Scorecard stations={data.stations} />
            </ModelChapter>
            <LimitsChapter data={data} />
            <p className="mt-6 max-w-[78ch] text-caption text-ink-tertiary">
              Every number is copied from <code className="font-mono">model/reports/{data.version}/</code>. Method in full: <code className="font-mono">docs/MODEL.md</code>.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
