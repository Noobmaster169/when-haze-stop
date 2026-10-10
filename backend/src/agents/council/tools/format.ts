import type { Complex } from "../../../suppression/complexes";
import type { CouncilContext } from "../context";
import { pct } from "./types";

/** One complex as a line of a table the seats read. Ids are the facts they cite. */
export function complexLine(complex: Complex, ctx: CouncilContext): string {
  const shares = ctx.shares(complex.id);
  const where = `${complex.place.name}, ${complex.place.province}, ${complex.place.country}`;
  const night = complex.nightShare === null ? "night share unknown" : `night ${complex.nightShare.toFixed(2)}`;
  const kind = complex.peat ? "peat" : "surface";
  const influence = shares ? `share of KL's coming smoke ${shares.map((share, m) => `W${m + 1} ${pct(share)}`).join(" ")}` : "influence not computed (too small or too far)";
  const km = ctx.logistics(complex.id)?.kmToTarget;
  return `${complex.id} | ${where} | ${Math.round(complex.firePowerMw)} MW/day, ${Math.round(complex.detections)} detections/day | burned ${complex.persistenceDays} of 30 days | peat ${complex.peatShare.toFixed(2)}, ${night} -> ${kind} | ${km === undefined ? "" : `${Math.round(km)} km to KL | `}${influence}`;
}

export const meanOf = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
