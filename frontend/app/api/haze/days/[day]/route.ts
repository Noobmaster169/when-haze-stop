import { getHazeDay } from "@/lib/api-client";
import { backendFailure } from "@/lib/api-route";

/** One past day as the map draws it: its fires, its wind, and the haze field where readings exist. */
export async function GET(_request: Request, ctx: RouteContext<"/api/haze/days/[day]">) {
  const { day } = await ctx.params;
  try {
    const found = await getHazeDay(day);
    if (!found) return Response.json({ error: "A day is written YYYY-MM-DD." }, { status: 400 });
    return Response.json(found);
  } catch (error) {
    return backendFailure("read a past day", error);
  }
}
