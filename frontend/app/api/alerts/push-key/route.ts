import { getPushKey } from "@/lib/api-client";
import { passRead } from "@/lib/api-route";

/** The key a browser subscribes to push with, or null when this server sends none. */
export async function GET() {
  return passRead("read the push key", getPushKey);
}
