import { Tile } from "@/components/simulation/chapter";
import type { ModelPerformance } from "@/lib/model-performance-schema";

import { ErrorHistogram } from "./error-histogram";
import { ModelChapter } from "./model-chapter";
import { percent } from "./table";

/** Chapter 3: the error of every next-day station-day as paired bars, then the same two scores two days ahead. */
export function ErrorChapter({ data }: { data: ModelPerformance }) {
  const all = data.overall.all;
  const two = data.twoDay;
  return (
    <ModelChapter id="error">
      <ErrorHistogram bins={data.errorHistogram} label={`Next-day error over ${all.days} station-days, the model against no change`} />
      <p className="mt-1 text-caption text-ink-tertiary">
        Next day: mean error {all.mae} µg/m³ against {all.maeNoChange} for no change.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Tile figure={`${percent(two.within20)} vs ${percent(two.within20NoChange)}`} label={`two days ahead, within 20 µg/m³: model vs no change, ${two.days} station-days`} />
        <Tile figure={`${two.mae} vs ${two.maeNoChange}`} label="two days ahead, mean error in µg/m³: model vs no change" />
      </div>
    </ModelChapter>
  );
}
