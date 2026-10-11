import { getHazeDays } from "@/lib/api-client";
import { passRead } from "@/lib/api-route";

/** The stored days of fires, for choosing a past day to look at. */
export async function GET() {
  return passRead("read the stored days", getHazeDays);
}
