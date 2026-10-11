import { getAlerts } from "@/lib/api-client";
import { passRead } from "@/lib/api-route";

/** Alerts, newest first: for the stations a browser follows, or for every station when it names none. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const after = Number(params.get("after") ?? 0);
  return passRead("read alerts", () => getAlerts({ session: params.get("session") ?? undefined, after: Number.isInteger(after) && after > 0 ? after : undefined }));
}
