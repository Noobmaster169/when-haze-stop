import type { Statement, StatementAction } from "../contracts";
import { flatten } from "./statement-text";

/** Which places an order covers. Pure: the service hands in where districts are. */

export interface Place {
  name: string;
  state: string;
  lat: number;
  lon: number;
}

/** Where a district is, from the gazetteer, or null when it is not known. */
export type DistrictCentre = (name: string) => { lat: number; lon: number } | null;

const DISTRICT_KM = 40;

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371;
}

/** The statement names this place's state, its district, or the whole country. */
export function covers(statement: Pick<Statement, "nationwide" | "states" | "districts">, place: Place, centre: DistrictCentre): boolean {
  if (statement.nationwide || statement.states.includes(place.state)) return true;
  return statement.districts.some((district) => {
    if (flatten(district) === flatten(place.name)) return true;
    const at = centre(district);
    return at !== null && km(at, place) <= DISTRICT_KM;
  });
}

/** The actions worth an alert: they change what a person does tomorrow. */
export const ACTING: ReadonlySet<StatementAction> = new Set(["schools-close", "outdoor-stop", "emergency", "work-from-home"]);

/** Orders that cover a place and are in force or about to be. */
export function ordersFor(statements: Statement[], place: Place, centre: DistrictCentre): Statement[] {
  return statements.filter(
    (statement) => statement.kind === "order" && ACTING.has(statement.action) && (statement.status === "in-force" || statement.status === "upcoming") && covers(statement, place, centre),
  );
}
