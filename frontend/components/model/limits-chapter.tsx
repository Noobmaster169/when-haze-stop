import type { ModelPerformance } from "@/lib/model-performance-schema";

import { ModelChapter } from "./model-chapter";
import { Bullets, Strong } from "./prose";
import { percent } from "./table";

/** Chapter 7: the limits, one line each, and the gate the model must pass before anyone sees it. */
export function LimitsChapter({ data }: { data: ModelPerformance }) {
  const coverage = Object.values(data.bandCoverage);
  const singapore = data.overall.nea.days;
  const doe = data.overall.doe.days;
  return (
    <ModelChapter id="limits">
      <Bullets>
        <li>
          <Strong>Under-calls sharp changes:</Strong> right way, too small a step, as the scatter shows.
        </li>
        <li>
          <Strong>The map&apos;s forecast frames are not the model:</Strong> it feeds the station panel, the alerts and the assistant.
        </li>
        <li>
          <Strong>The band is too narrow:</Strong> it holds {percent(Math.min(...coverage))} to {percent(Math.max(...coverage))} of real peaks where 80% is the design.
        </li>
        <li>
          <Strong>Never forecast a crossing of 200:</Strong> cautious at the extreme.
        </li>
        <li>
          <Strong>Little warning before an episode starts:</Strong> it tracks a rise once it has begun.
        </li>
        <li>
          <Strong>The long record is Singapore&apos;s:</Strong> {singapore} region-days over ten weeks; DOE gives {doe} station-days, one week.
        </li>
      </Bullets>
      <p className="mt-4 max-w-[72ch] text-body text-ink-secondary">
        <Strong>Gated.</Strong> Shadow mode first: it is shown only after 14 days scoring at least 10% better than the hourly forecast on live DOE stations.
      </p>
    </ModelChapter>
  );
}
