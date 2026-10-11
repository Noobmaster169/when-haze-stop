import { getCityAir } from "@/lib/api-client";
import { backendFailure } from "@/lib/api-route";

/** One city's air hour by hour, with how far one could see through it. */
export async function GET(_request: Request, ctx: RouteContext<"/api/haze/cities/[key]">) {
  const { key } = await ctx.params;
  try {
    const air = await getCityAir(key);
    if (!air) return Response.json({ error: "There is no city with that key." }, { status: 404 });
    return Response.json(air);
  } catch (error) {
    return backendFailure("read a city", error);
  }
}
