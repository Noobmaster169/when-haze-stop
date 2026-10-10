import { randomUUID } from "node:crypto";

import type { ChatConversation, ChatToolCall, ChatTurn } from "../contracts";
import type { Queryable } from "../db";

/** Conversations and their turns. Columns are snake_case; this file maps to camelCase and nothing else does. */

interface ConversationRow {
  id: string;
  title: string | null;
  created_at: Date;
  updated_at: Date;
}

interface TurnRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls: ChatToolCall[];
  skills_used: string[];
  stopped: boolean;
  created_at: Date;
}

const CONVERSATION = "id, title, created_at, updated_at";
const TURN = "id, role, content, tool_calls, skills_used, stopped, created_at";

function toConversation(row: ConversationRow): ChatConversation {
  return { id: row.id, title: row.title, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
}

function toTurn(row: TurnRow): ChatTurn {
  return {
    // bigserial arrives as a string. A conversation will not reach 2^53 turns.
    id: Number(row.id),
    role: row.role,
    content: row.content,
    toolCalls: row.tool_calls,
    skillsUsed: row.skills_used,
    stopped: row.stopped,
    createdAt: row.created_at.toISOString(),
  };
}

export async function create(db: Queryable): Promise<ChatConversation> {
  const { rows } = await db.query<ConversationRow>(
    `insert into chat_conversations (id) values ($1) returning ${CONVERSATION}`,
    [randomUUID()],
  );
  return toConversation(rows[0]);
}

/** Most recently used first, which is the order the history list draws them in. */
export async function list(db: Queryable, limit = 50): Promise<ChatConversation[]> {
  const { rows } = await db.query<ConversationRow>(
    `select ${CONVERSATION} from chat_conversations order by updated_at desc limit $1`,
    [limit],
  );
  return rows.map(toConversation);
}

export async function find(db: Queryable, id: string): Promise<ChatConversation | null> {
  const { rows } = await db.query<ConversationRow>(`select ${CONVERSATION} from chat_conversations where id = $1`, [id]);
  return rows[0] ? toConversation(rows[0]) : null;
}

export async function remove(db: Queryable, id: string): Promise<boolean> {
  const { rowCount } = await db.query("delete from chat_conversations where id = $1", [id]);
  return (rowCount ?? 0) > 0;
}

/** Sets the title only where there is none, so the first question names a conversation and later ones do not rename it. */
export async function titleIfUnnamed(db: Queryable, id: string, title: string): Promise<void> {
  await db.query("update chat_conversations set title = $2 where id = $1 and title is null", [id, title]);
}

export async function turns(db: Queryable, conversationId: string): Promise<ChatTurn[]> {
  const { rows } = await db.query<TurnRow>(
    `select ${TURN} from chat_turns where conversation_id = $1 order by id`,
    [conversationId],
  );
  return rows.map(toTurn);
}

/** The last `limit` turns, oldest first. */
export async function recentTurns(db: Queryable, conversationId: string, limit: number): Promise<ChatTurn[]> {
  const { rows } = await db.query<TurnRow>(
    `select ${TURN} from chat_turns where conversation_id = $1 order by id desc limit $2`,
    [conversationId, limit],
  );
  return rows.reverse().map(toTurn);
}

export async function addUserTurn(db: Queryable, conversationId: string, content: string): Promise<ChatTurn> {
  const { rows } = await db.query<TurnRow>(
    `insert into chat_turns (conversation_id, role, content) values ($1, 'user', $2) returning ${TURN}`,
    [conversationId, content],
  );
  await touch(db, conversationId);
  return toTurn(rows[0]);
}

export interface NewAssistantTurn {
  answer: string;
  toolCalls: ChatToolCall[];
  skillsUsed: string[];
  stopped: boolean;
}

export async function addAssistantTurn(db: Queryable, conversationId: string, turn: NewAssistantTurn): Promise<ChatTurn> {
  const { rows } = await db.query<TurnRow>(
    `insert into chat_turns (conversation_id, role, content, tool_calls, skills_used, stopped)
     values ($1, 'assistant', $2, $3, $4, $5) returning ${TURN}`,
    [conversationId, turn.answer, JSON.stringify(turn.toolCalls), turn.skillsUsed, turn.stopped],
  );
  await touch(db, conversationId);
  return toTurn(rows[0]);
}

async function touch(db: Queryable, conversationId: string): Promise<void> {
  await db.query("update chat_conversations set updated_at = now() where id = $1", [conversationId]);
}
