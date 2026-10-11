import { ChatConversation, ChatConversationList, ChatThread } from "./chat-schemas";
import { BackendError, get, parseAs, refusalMessage, request } from "./transport";

/**
 * A turn can take minutes: up to eight model calls, each an agent session
 * started by the proxy. This sits just under the 300 s `maxDuration` the route
 * handler declares, so a slow answer times out here with a message the page
 * can render rather than as a platform error page.
 */
const TURN_TIMEOUT_MS = 290_000;

export type Outcome<T> = { ok: true; value: T } | { ok: false; message: string };

export async function listConversations(): Promise<ChatConversation[]> {
  return (await get(ChatConversationList, "/chat/conversations")).conversations;
}

/** Null for a conversation the backend no longer holds, so the dock starts fresh rather than failing. */
export async function getThread(id: string): Promise<ChatThread | null> {
  try {
    return await get(ChatThread, `/chat/${id}`);
  } catch (error) {
    if (error instanceof BackendError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

export async function createConversation(): Promise<Outcome<ChatConversation>> {
  const response = await request("/chat/conversations", { method: "POST" });
  if (!response.ok) return { ok: false, message: await refusalMessage(response) };
  return { ok: true, value: await parseAs(ChatConversation, response, "POST /chat/conversations") };
}

/**
 * One question, asked for as a stream of events.
 *
 * The response is handed back whole, body unread, because the caller is a route
 * whose job is to pass it to the browser rather than to understand it. A frame
 * is parsed by the client that draws it.
 */
export async function streamQuestion(id: string, content: string, sessionId: string | undefined, signal?: AbortSignal): Promise<Response> {
  return request(`/chat/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, sessionId }),
    headers: { accept: "text/event-stream" },
    timeoutMs: TURN_TIMEOUT_MS,
    signal,
  });
}

export async function deleteConversation(id: string): Promise<Outcome<null>> {
  const response = await request(`/chat/${id}`, { method: "DELETE" });
  if (!response.ok) return { ok: false, message: await refusalMessage(response) };
  return { ok: true, value: null };
}
