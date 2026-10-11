import type { Network, Station } from "../../../contracts";
import { band } from "../../../haze/guidelines";

/** How the tools write times and readings, so every answer reads the same way. */

const MALAYSIA = "Asia/Kuala_Lumpur";

/** "Sat 10 Oct, 11:00", in Malaysian time, which is the only clock the people asking are on. */
export function when(at: Date | string): string {
  const date = typeof at === "string" ? new Date(at) : at;
  const parts = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: MALAYSIA }).formatToParts(date);
  const part = (type: string): string => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")}, ${part("hour")}:${part("minute")}`;
}

/** "Sun 11 Oct" for a `YYYY-MM-DD` day. */
export function dayName(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`)).replace(",", "");
}

/** "API 182 (Unhealthy)" for a DOE station; NEA's reading is its PSI, built the same way and on the same bands. */
export function reading(api: number, network: Network = "doe"): string {
  return `${INDEX[network]} ${Math.round(api)} (${band(api)})`;
}

export const INDEX: Record<Network, string> = { doe: "API", nea: "PSI" };

/** "DOE station CA24N" or "NEA region SGCENTRAL". */
export function stationLabel(station: Pick<Station, "id" | "network">): string {
  return station.network === "nea" ? `NEA region ${station.id}` : `DOE station ${station.id}`;
}

export function percent(chance: number): string {
  return `${Math.round(chance * 100)}%`;
}
