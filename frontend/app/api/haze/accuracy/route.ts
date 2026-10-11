import { getAccuracy } from "@/lib/api-client";
import { passRead } from "@/lib/api-route";

/** How the forecast has done against the readings that followed. */
export async function GET() {
  return passRead("read the track record", getAccuracy);
}
