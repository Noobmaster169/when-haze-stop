import { Tile } from "@/components/simulation/chapter";
import type { ModelPerformance } from "@/lib/model-performance-schema";

import { withinShare } from "./figures";
import { ModelChapter } from "./model-chapter";
import { percent } from "./table";

/** The verdict: five tiles, each one number against the "no change" forecast where no change has an answer. */
export function VerdictChapter({ data }: { data: ModelPerformance }) {
  const all = data.overall.all;
  const noChange20 = withinShare(data.errorHistogram, 20, "noChange");
  return (
    <ModelChapter id="verdict">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile figure={all.days.toLocaleString("en-GB")} label={`station-days tested, at ${data.instruments} instruments; no change means tomorrow equals today`} />
        <Tile figure={percent(all.within20)} label={`next day within 20 µg/m³; no change ${percent(noChange20)}`} />
        <Tile figure={percent(all.hit150)} label={`crossings of 150 caught; no change ${percent(all.hitNoChange)}`} />
        <Tile figure={percent(all.directionRight)} label={`direction right on ${all.bigMoves} moves of 15 µg/m³ or more`} />
        <Tile figure={percent(data.twoDay.within20)} label={`two days ahead within 20; no change ${percent(data.twoDay.within20NoChange)}`} />
      </div>
    </ModelChapter>
  );
}
