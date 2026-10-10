import { getGuidelines } from "@/lib/api-client";
import { passRead } from "@/lib/api-route";

/** The official lines and what crossing each means. */
export async function GET() {
  return passRead("read the guidelines", getGuidelines);
}
