import { getStationOutlook } from "@/lib/api-client";
import { backendFailure } from "@/lib/api-route";

/** One station's readings, forecast and day-by-day outlook. */
export async function GET(_request: Request, ctx: RouteContext<"/api/haze/stations/[id]">) {
  const { id } = await ctx.params;
  try {
    const outlook = await getStationOutlook(id);
    if (!outlook) return Response.json({ error: "There is no station with that id." }, { status: 404 });
    return Response.json(outlook);
  } catch (error) {
    return backendFailure("read a station", error);
  }
}
