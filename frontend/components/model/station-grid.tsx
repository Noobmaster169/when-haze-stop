import type { PanelSet, StationGroup } from "./figures";
import { StationPanel } from "./station-panel";

/**
 * One set of small multiples, one column on a phone. A plain set is one grid
 * of panels. A `dense` set (DOE, by state) packs its groups four tracks across:
 * each group spans as many tracks as it has panels, up to the row, and the
 * grid fills holes with later groups, so a state of one station does not
 * leave a row three-quarters empty.
 */

const SPAN = ["", "", "sm:col-span-2", "sm:col-span-2 lg:col-span-3", "sm:col-span-2 lg:col-span-4"];
const INNER = ["", "grid-cols-1", "grid-cols-1 sm:grid-cols-2", "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"];

function Heading({ group }: { group: StationGroup }) {
  return (
    <h4 className="mb-1.5 text-caption text-ink-tertiary">
      {group.title} <span className="font-mono text-mono-xs">{group.stations.length}</span>
    </h4>
  );
}

export function StationGrid({ set, dense = false }: { set: PanelSet; dense?: boolean }) {
  if (!dense) {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {set.groups
          .flatMap((group) => group.stations)
          .map((station) => (
            <StationPanel key={station.id} station={station} top={set.top} />
          ))}
      </div>
    );
  }
  return (
    <div className="grid grid-flow-row-dense grid-cols-1 gap-x-2 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
      {set.groups.map((group) => {
        const across = Math.min(group.stations.length, 4);
        return (
          <div key={group.title} className={SPAN[across]}>
            <Heading group={group} />
            <div className={`grid gap-2 ${INNER[across]}`}>
              {group.stations.map((station) => (
                <StationPanel key={station.id} station={station} top={set.top} width={220} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
