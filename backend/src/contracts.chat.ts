import { z } from "zod";

/**
 * The chat: a conversation, its turns, and what one turn reports while it runs.
 *
 * Re-exported from contracts.ts and mirrored by hand as zod schemas in
 * frontend/lib/api/chat-schemas.ts. Change one, change the other in the same
 * commit.
 */

/** One tool the agent called on a turn, with enough of the result to show what came back. */
export const ChatToolCall = z.object({
  tool: z.string(),
  args: z.record(z.string(), z.unknown()),
  /** The agent's own sentence on why it reached for this tool. */
  thought: z.string(),
  ok: z.boolean(),
  /** One line for the page: a short rendering of the result, or the error where the call failed. */
  preview: z.string(),
  durationMs: z.number().int(),
});
export type ChatToolCall = z.infer<typeof ChatToolCall>;

export const ChatConversation = z.object({
  id: z.uuid(),
  /** Null until the first question is asked, which is what titles it. */
  title: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ChatConversation = z.infer<typeof ChatConversation>;

export const ChatTurn = z.object({
  id: z.number().int(),
  role: z.enum(["user", "assistant"]),
  /** What the person typed, or the agent's answer in Markdown. */
  content: z.string(),
  /** Empty on a user turn. */
  toolCalls: z.array(ChatToolCall),
  skillsUsed: z.array(z.string()),
  /** The person stopped this turn, so `content` is what had been written by then. */
  stopped: z.boolean(),
  createdAt: z.string(),
});
export type ChatTurn = z.infer<typeof ChatTurn>;

export const ChatThread = z.object({ conversation: ChatConversation, turns: z.array(ChatTurn) });
export type ChatThread = z.infer<typeof ChatThread>;

export const ChatConversationList = z.object({ conversations: z.array(ChatConversation) });
export type ChatConversationList = z.infer<typeof ChatConversationList>;

export const NewMessage = z.object({ content: z.string().trim().min(1).max(20_000) });
export type NewMessage = z.infer<typeof NewMessage>;

/** `reading` the question, `looking` with tools, `writing` the answer. */
export const ChatPhase = z.enum(["reading", "looking", "writing"]);
export type ChatPhase = z.infer<typeof ChatPhase>;

/** Where a running turn has got to. A repaint, never a record: the answer event is what the page keeps. */
export const ChatProgress = z.object({
  step: z.number().int(),
  phase: ChatPhase,
  /** The answer written so far. Empty until the final step starts writing it. */
  answer: z.string(),
  /** The tools running right now, on a `looking` step. */
  tools: z.array(z.string()),
});
export type ChatProgress = z.infer<typeof ChatProgress>;

/** What `POST /chat/:id/messages` answers: the stored assistant turn. */
export const ChatAnswer = z.object({
  /** The person's own turn as stored, so the page can swap its optimistic copy for the real row. */
  asked: ChatTurn,
  turn: ChatTurn,
  /** The loop ran out of steps before it had an answer, and said so. */
  exhausted: z.boolean(),
});
export type ChatAnswer = z.infer<typeof ChatAnswer>;
