import { createConversation, listConversations } from "@/lib/api-client";
import { backendFailure, passRead } from "@/lib/api-route";

export async function GET() {
  return passRead("list conversations", async () => ({ conversations: await listConversations() }));
}

export async function POST() {
  try {
    const outcome = await createConversation();
    if (!outcome.ok) return Response.json({ error: outcome.message }, { status: 502 });
    return Response.json(outcome.value);
  } catch (error) {
    return backendFailure("open a conversation", error);
  }
}
