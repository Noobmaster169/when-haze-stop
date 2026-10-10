/**
 * The hour a model run should start from.
 *
 * DOE posts an hour station by station over the next twenty minutes or so: at
 * five past, three stations had 07:00 and 65 did not. A run from such an hour
 * pulls the map to three stations and leaves the rest as bare model, and it is
 * never redone. So a run starts from the newest hour that most stations have
 * reported, measured against the best-reported hour of the last few days.
 */

/** The share of the usual station count that makes an hour complete. */
const COMPLETE_SHARE = 0.8;

export function newestCompleteHour(counts: readonly { at: Date; stations: number }[]): Date | null {
  const usual = Math.max(0, ...counts.map((hour) => hour.stations));
  if (usual === 0) return null;
  let newest: Date | null = null;
  for (const hour of counts) {
    if (hour.stations >= COMPLETE_SHARE * usual && (!newest || hour.at > newest)) newest = hour.at;
  }
  return newest;
}
