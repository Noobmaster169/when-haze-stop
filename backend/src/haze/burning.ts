import { confirmedFires } from "./fire-confirm";
import { screenDetections } from "./fire-screen";
import { pairCellDays, type Detection, type StoredCellDay, toCellDays } from "./fires";
import { type FixedMask, withoutFixedSources } from "./fixed-sources";
import { onVegetation } from "./vegetation";

/**
 * From what the satellites reported to what the model burns, in one place so
 * the hourly fetch and the archive replay cannot screen differently. A
 * satellite sees heat; what is kept is vegetation burning: not sun glint or
 * open sea, not a labelled flare, smelter or volcano, not heat on ground that
 * is not vegetation, and not one faint pixel seen once.
 *
 * Bump SCREEN_VERSION when a rule here or in the screens it calls changes:
 * the archive replay works stored days out again when it sees a new number.
 */
export const SCREEN_VERSION = 3;

export interface Burning {
  cells: StoredCellDay[];
  glint: number;
  offshore: number;
  fixed: number;
  /** Heat on built-up land, bare ground or water: towns, plants, mines, ships near the coast. */
  notVegetation: number;
  unconfirmed: number;
}

export function burningCells(detections: Detection[], mask: FixedMask): Burning {
  const screened = screenDetections(detections);
  const { burning, fixed } = withoutFixedSources(screened.kept, mask);
  const vegetation = burning.filter((hit) => onVegetation(hit.lat, hit.lon));
  const { confirmed, unconfirmed } = confirmedFires(vegetation);
  return {
    cells: pairCellDays(toCellDays(screened.kept), toCellDays(confirmed)),
    glint: screened.glint,
    offshore: screened.offshore,
    fixed,
    notVegetation: burning.length - vegetation.length,
    unconfirmed,
  };
}
