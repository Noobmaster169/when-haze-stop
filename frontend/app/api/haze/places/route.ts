import { findPlaces } from "@/lib/api-client";
import { passRead } from "@/lib/api-route";

/** A place by name, with the station that speaks for it. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ places: [] });
  return passRead("search for a place", () => findPlaces(query, params.get("remote") === "1"));
}
