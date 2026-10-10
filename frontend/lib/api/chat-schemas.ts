import { z } from "zod";

/**
 * The chat contract, mirrored by hand from backend/src/contracts.chat.ts.
 * Change one, change the other in the same commit: every response is parsed
 * against these, so a drift fails at the boundary naming the field.
 */

export const ChatToolCall = z.object({
  tool: z.string(),
  args: z.record(z.string(), z.unknown()),
  thought: z.string(),
  ok: z.boolean(),
  preview: z.string(),
  source: z.string().nullable().default(null),
  durationMs: z.number().int(),
});
export type ChatToolCall = z.infer<typeof ChatToolCall>;

export const ChatConversation = z.object({
  id: z.uuid(),
  title: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ChatConversation = z.infer<typeof ChatConversation>;

export const ChatTurn = z.object({
  id: z.number().int(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  toolCalls: z.array(ChatToolCall),
  skillsUsed: z.array(z.string()),
  stopped: z.boolean(),
  createdAt: z.string(),
});
export type ChatTurn = z.infer<typeof ChatTurn>;

export const ChatThread = z.object({ conversation: ChatConversation, turns: z.array(ChatTurn) });
export type ChatThread = z.infer<typeof ChatThread>;

export const ChatConversationList = z.object({ conversations: z.array(ChatConversation) });
export type ChatConversationList = z.infer<typeof ChatConversationList>;

export const ChatPhase = z.enum(["reading", "looking", "writing"]);
export type ChatPhase = z.infer<typeof ChatPhase>;

export const ChatProgress = z.object({
  step: z.number().int(),
  phase: ChatPhase,
  answer: z.string(),
  tools: z.array(z.string()),
});
export type ChatProgress = z.infer<typeof ChatProgress>;

export const ChatAnswer = z.object({ asked: ChatTurn, turn: ChatTurn, exhausted: z.boolean() });
export type ChatAnswer = z.infer<typeof ChatAnswer>;
