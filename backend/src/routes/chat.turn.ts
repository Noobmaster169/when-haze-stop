import type { Pool } from "pg";

import { conversationTitle, runTurn } from "../agents/chat";
import type { LlmClient } from "../agents/llm-client";
import type { ChatAnswer, ChatConversation, ChatProgress, ChatToolCall, NewMessage } from "../contracts";
import { childLogger } from "../lib/logger";
import { chat } from "../repositories";

/**
 * One turn, end to end: load what the agent is given, run it, store what came
 * back. Split from chat.routes.ts, which does the HTTP around it.
 *
 * Thin on purpose. Everything here is load, call, save; the loop is in
 * `agents/chat/`, and nothing in this file decides anything about an answer.
 */

const log = childLogger({ module: "chat.turn" });

/**
 * How much of the conversation the model is given back: the last twenty turns.
 * The whole history of a long conversation would crowd out the question.
 */
const HISTORY_TURNS = 20;

export interface TurnDeps {
  pool: Pool;
  llm: LlmClient;
  /** Aborted when the person stops the turn. */
  signal: AbortSignal;
  /** Where the turn has got to, for a caller that is streaming it back. Absent, the turn does not stream. */
  onProgress?(progress: ChatProgress): void;
  /** A step's calls, the moment they finish, for a caller streaming the turn. */
  onCalls?(calls: ChatToolCall[]): void;
}

export async function answerTurn(deps: TurnDeps, conversation: ChatConversation, message: NewMessage): Promise<ChatAnswer> {
  const id = conversation.id;

  // The question is stored before the model is asked. A turn that fails halfway
  // must still leave the person's own words on the page, or they retype them.
  const asked = await chat.addUserTurn(deps.pool, id, message.content);
  await chat.titleIfUnnamed(deps.pool, id, conversationTitle(message.content));

  const previous = (await chat.recentTurns(deps.pool, id, HISTORY_TURNS)).slice(0, -1);
  const result = await runTurn(
    {
      llm: deps.llm,
      pool: deps.pool,
      signal: deps.signal,
      tools: { pool: deps.pool },
      onStep: deps.onCalls,
      onProgress: deps.onProgress,
    },
    {
      conversationId: id,
      question: message.content,
      history: previous.map((turn) => ({ role: turn.role, content: turn.content })),
      today: new Date().toISOString().slice(0, 10),
      stickySkills: [...new Set(previous.flatMap((turn) => turn.skillsUsed))],
    },
  );

  const turn = await chat.addAssistantTurn(deps.pool, id, {
    answer: result.answer,
    toolCalls: result.toolCalls,
    skillsUsed: result.skillsUsed,
    stopped: result.stopped,
  });

  log.info(
    { conversationId: id, tools: result.toolCalls.length, exhausted: result.exhausted, stopped: result.stopped },
    "a chat turn answered",
  );
  return { asked, turn, exhausted: result.exhausted };
}
