import { getHazeMap } from "@/lib/api-client";
import { passRead } from "@/lib/api-route";

/** Everything the map draws: frames for the week behind and the days ahead, stations, fires and wind. */
export async function GET() {
  return passRead("read the haze map", getHazeMap);
}
