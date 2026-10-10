import { getAreas } from "@/lib/api-client";
import { passRead } from "@/lib/api-route";

/** One card per area a browser follows. */
export async function GET(request: Request) {
  const session = new URL(request.url).searchParams.get("session") ?? "";
  if (session.length < 8) return Response.json({ areas: [] });
  return passRead("read followed areas", () => getAreas(session));
}
