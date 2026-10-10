import { streamQuestion } from "@/lib/api-client";
import { backendFailure } from "@/lib/api-route";

/**
 * One question, and the answer as it is written.
 *
 * A turn is up to eight model calls through a proxy that starts an agent
 * session per call, so this can take minutes. `maxDuration` is the platform's
 * ceiling and the client's timeout sits just under it.
 *
 * The backend's own stream is handed straight to the browser, body unread.
 * Reading it here to re-emit it would buy nothing and cost the thing the
 * stream exists for.
 */
export const maxDuration = 300;

export async function POST(request: Request, ctx: RouteContext<"/api/chat/[id]/messages">) {
  const { id } = await ctx.params;
  try {
    const body = (await request.json()) as { content?: unknown };
    if (typeof body.content !== "string" || body.content.trim() === "") {
      return Response.json({ error: "A question needs content." }, { status: 400 });
    }

    // The browser's abort is the person pressing Stop, and it has to reach the
    // backend: that is how the turn is ended and stored with what it had.
    const upstream = await streamQuestion(id, body.content, request.signal);
    if (!upstream.ok || !upstream.body) {
      return Response.json({ error: `The backend refused the question with ${upstream.status}.` }, { status: 502 });
    }
    return new Response(upstream.body, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        // nginx and most hosts buffer a body by default, which holds every
        // frame until the turn ends and undoes the streaming.
        "x-accel-buffering": "no",
      },
    });
  } catch (error) {
    return backendFailure("ask a question", error);
  }
}
