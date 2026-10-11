import type { NextRequest } from "next/server";

import { getModelLive } from "@/lib/api-client";
import { passRead } from "@/lib/api-route";

/** The learned model's live record: whose forecast is showing, how it scores, the stations to watch and the ledger. */
export async function GET(request: NextRequest) {
  const follow = (request.nextUrl.searchParams.get("follow") ?? "").split(",").filter((id) => id.length > 0);
  return passRead("read the model's live record", () => getModelLive(follow));
}
