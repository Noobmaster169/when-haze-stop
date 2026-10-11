import { confirmedFires } from "./fire-confirm";
import { screenDetections } from "./fire-screen";
import { pairCellDays, type Detection, type StoredCellDay, toCellDays } from "./fires";
import { type FixedMask, withoutFixedSources } from "./fixed-sources";

/**
 * From what the satellites reported to what the model burns, in one place so
 * the hourly fetch and the archive replay cannot screen differently.
 *
 * Bump SCREEN_VERSION when a rule here or in the screens it calls changes:
 * the archive replay works stored days out again when it sees a new number.
 */
export const SCREEN_VERSION = 2;

export interface Burning {
  cells: StoredCellDay[];
  glint: number;
  offshore: number;
  fixed: number;
  unconfirmed: number;
}

export function burningCells(detections: Detection[], mask: FixedMask): Burning {
  const screened = screenDetections(detections);
  const { burning, fixed } = withoutFixedSources(screened.kept, mask);
  const { confirmed, unconfirmed } = confirmedFires(burning);
  return { cells: pairCellDays(toCellDays(screened.kept), toCellDays(confirmed)), glint: screened.glint, offshore: screened.offshore, fixed, unconfirmed };
}
