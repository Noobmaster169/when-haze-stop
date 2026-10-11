import type { ModelPerformance } from "@/lib/model-performance-schema";

import { ChangeScatter } from "./change-scatter";
import { panelSets, type PanelSet } from "./figures";
import { ModelChapter } from "./model-chapter";
import { H3 } from "./prose";
import { SensorToggle } from "./sensor-toggle";
import { SeriesLegend } from "./series-legend";
import { StationGrid } from "./station-grid";

/** Chapter 5: every station-day's change as one scatter, then every station as a small multiple, grouped. */

function Caption({ set, text }: { set: PanelSet; text: string }) {
  return (
    <p className="mb-2 text-caption text-ink-tertiary">
      {text} Shared scale 0 to {set.top} µg/m³.
    </p>
  );
}

export function ChangeChapter({ data }: { data: ModelPerformance }) {
  const sets = panelSets(data.stations);
  const sensors = sets.sensors?.groups.reduce((sum, group) => sum + group.stations.length, 0) ?? 0;
  return (
    <ModelChapter id="change">
      <ChangeScatter points={data.scatter} />
      <p className="mt-1 text-caption text-ink-tertiary">A cloud flatter than the diagonal: right way, too small a step.</p>

      <div className="mt-6">
        <SeriesLegend />
      </div>
      {sets.singapore ? (
        <>
          <H3>Singapore regions</H3>
          <Caption set={sets.singapore} text={`${sets.singapore.groups[0].stations[0].rows.length} days each, August to October.`} />
          <StationGrid set={sets.singapore} />
        </>
      ) : null}
      {sets.doe ? (
        <>
          <H3>DOE stations, by state</H3>
          <Caption set={sets.doe} text={`${sets.doe.groups[0].stations[0].rows.length} days each, the week DOE serves.`} />
          <StationGrid set={sets.doe} dense />
        </>
      ) : null}
      {sets.sensors ? (
        <>
          <H3>Sensors</H3>
          <Caption set={sets.sensors} text="Days vary by sensor." />
          <SensorToggle count={sensors}>
            <StationGrid set={sets.sensors} />
          </SensorToggle>
        </>
      ) : null}
    </ModelChapter>
  );
}
