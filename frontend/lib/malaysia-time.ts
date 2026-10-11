const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const OFFSET_MS = 8 * 3_600_000;

/**
 * Times as the people reading them live them: Malaysian time, UTC+8, all year.
 *
 * Shifted by hand and read back through the UTC getters, so a server render
 * and the browser that hydrates it agree whatever zone either is in.
 */
function shifted(at: number | string): Date {
  return new Date((typeof at === "string" ? Date.parse(at) : at) + OFFSET_MS);
}

/** "Sat 10 Oct, 11:00". */
export function malaysiaWhen(at: number | string): string {
  const date = shifted(at);
  if (Number.isNaN(date.getTime())) return String(at);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${DAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}, ${hours}:${minutes}`;
}

/** "Sat 10". */
export function malaysiaDay(at: number | string): string {
  const date = shifted(at);
  return `${DAYS[date.getUTCDay()]} ${date.getUTCDate()}`;
}

/** "Sun 11 Oct" for a `YYYY-MM-DD` local day, as the outlook names its days. */
export function dayName(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return `${DAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** The instants at which a new Malaysian day starts, strictly inside a span. */
export function malaysiaMidnights(from: number, to: number): number[] {
  const marks: number[] = [];
  const first = Math.floor((from + OFFSET_MS) / 86_400_000) * 86_400_000 + 86_400_000 - OFFSET_MS;
  for (let at = first; at < to; at += 86_400_000) marks.push(at);
  return marks;
}

/** "15:20". */
export function malaysiaClock(at: number | string): string {
  const date = shifted(at);
  if (Number.isNaN(date.getTime())) return String(at);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

/** "2 Oct". */
export function malaysiaDate(at: number | string): string {
  const date = shifted(at);
  if (Number.isNaN(date.getTime())) return String(at);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}
