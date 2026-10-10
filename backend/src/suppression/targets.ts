/**
 * The areas the council can be asked to clear. Only Kuala Lumpur and its
 * surroundings for now; the page lists the others as coming later.
 *
 * An area is a set of DOE stations, because what the council is scored on is
 * the air those stations measure. Ids are DOE's, as stored in `stations`.
 */

export interface TargetArea {
  id: string;
  name: string;
  /** Where distances are measured from, and the map centres. */
  centre: { lat: number; lon: number };
  stationIds: string[];
}

export const TARGETS: Record<string, TargetArea> = {
  "klang-valley": {
    id: "klang-valley",
    name: "Kuala Lumpur and surroundings",
    centre: { lat: 3.14, lon: 101.69 },
    // The Klang Valley stations, Putrajaya, and the towns around it to the south and east.
    stationIds: ["CA15W", "CA16W", "CA17W", "CA19B", "CA20B", "CA21B", "CA22B", "CA23N", "CA24N"],
  },
};

export function target(id: string): TargetArea | null {
  return TARGETS[id] ?? null;
}
