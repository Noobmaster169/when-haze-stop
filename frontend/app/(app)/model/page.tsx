import { ChangeChapter } from "@/components/model/change-chapter";
import { MODEL_CHAPTERS, MODEL_SCROLL_ID } from "@/components/model/chapters";
import { PersonChapter, WeaknessesChapter } from "@/components/model/closing-chapters";
import { FunctionChapter } from "@/components/model/function-chapter";
import { ResultsChapter } from "@/components/model/results-chapter";
import { TargetChapter } from "@/components/model/target-chapter";
import { TestingChapter } from "@/components/model/testing-chapter";
import { Verdict } from "@/components/model/verdict";
import { Contents } from "@/components/simulation/contents";
import { MODEL_PERFORMANCE } from "@/lib/model-performance";

/**
 * The learned forecast, explained and scored, in numbered chapters beside the
 * Simulation page. Every figure comes from the model's published report,
 * bundled at build time, so the page needs no backend and changes only when a
 * new report is committed.
 */

export default function ModelPage() {
  const data = MODEL_PERFORMANCE;
  return (
    <main className="flex min-w-0 grow flex-col">
      <div id={MODEL_SCROLL_ID} className="min-h-0 grow overflow-y-auto px-6 pt-20 pb-8 md:px-10">
        <h1 className="font-display text-display text-ink">Model</h1>
        <p className="mt-1.5 max-w-[68ch] text-body text-ink-secondary">
          What the learned forecast predicts, exactly how it turns fires, wind and readings into a number, how its error was measured over months it never saw, how large that error is, and what it changes
          for a person deciding about tomorrow.
        </p>
        <p className="mt-1 font-mono text-caption text-ink-tertiary">
          Version {data.version}, tested {data.testSpan}
        </p>

        <div className="mt-6 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
          <aside className="mb-4 lg:sticky lg:top-0 lg:mb-0 lg:self-start">
            <Contents chapters={MODEL_CHAPTERS} scrollId={MODEL_SCROLL_ID} />
          </aside>

          <div className="min-w-0 max-w-[900px]">
            <div className="mb-4">
              <Verdict data={data} />
            </div>
            <div>
              <TargetChapter />
              <FunctionChapter example={data.example} />
              <TestingChapter />
              <ResultsChapter backtest={data.backtest} />
              <ChangeChapter data={data} />
              <WeaknessesChapter data={data} />
              <PersonChapter data={data} />
            </div>
            <p className="mt-6 max-w-[78ch] text-caption text-ink-tertiary">
              Every number on this page is copied from <code className="font-mono">model/reports/{data.version}/scores.json</code>, except the {data.example.station} row, which was computed from the live
              artifact on 11 October 2026, and the typical hazy-day levels, which come from the training parquet. Method and limitations in full: <code className="font-mono">docs/MODEL.md</code>.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
