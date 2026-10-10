import { deleteConversation, getThread } from "@/lib/api-client";
import { backendFailure, passRead } from "@/lib/api-route";

/** One conversation with its turns, for the dock resuming what it left. A 404 is `null` here and the dock starts fresh. */
export async function GET(_request: Request, ctx: RouteContext<"/api/chat/[id]">) {
  const { id } = await ctx.params;
  return passRead("read a conversation", async () => ({ thread: await getThread(id) }));
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/chat/[id]">) {
  const { id } = await ctx.params;
  try {
    const outcome = await deleteConversation(id);
    if (!outcome.ok) return Response.json({ error: outcome.message }, { status: 502 });
    return new Response(null, { status: 204 });
  } catch (error) {
    return backendFailure("delete a conversation", error);
  }
}
