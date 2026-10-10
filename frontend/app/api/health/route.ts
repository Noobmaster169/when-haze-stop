import { backendFailure } from "@/lib/api-route";
import { request } from "@/lib/api/transport";

/** The backend's own health report, passed through with its status. */
export async function GET() {
  try {
    const upstream = await request("/health", { timeoutMs: 5000 });
    return Response.json(await upstream.json(), { status: upstream.status });
  } catch (error) {
    return backendFailure("read health", error);
  }
}
