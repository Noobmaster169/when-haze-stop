import { z } from "zod";

import { TerminalError } from "../../lib/errors";
import type { Prompt } from "../prompts/registry";
import { callStructured, type StructuredDeps } from "../structured";
import type { CouncilContext } from "./context";
import type { Emitter } from "./events";
import type { Seat } from "./seats";
import { councilSkills, skillText } from "./skills/registry";
import { callCouncilTool, councilToolDescriptions } from "./tools";

/**
 * One seat's turn at one stage: look things up, then answer.
 *
 * The chat's protocol (agents/chat/loop.ts): each step is one model call that
 * returns either up to four tool calls, run together, or the stage's answer.
 * Every step becomes events for the replay: a one-line public gist of what
 * the seat is weighing, then a satellite per tool call. The gist is the seat's
 * own summary for the reader, never its hidden reasoning.
 */

const MAX_CALLS = 4;

const Call = z.object({ tool: z.string().min(1), args: z.record(z.string(), z.unknown()).default({}) });

export interface TurnDeps extends StructuredDeps {
  emit: Emitter;
  ctx: CouncilContext;
}

export interface TurnSpec<T> {
  seat: Seat;
  prompt: Prompt;
  /** Rendered as labelled sections after the seat's skills. */
  input: Record<string, string | string[]>;
  answer: z.ZodType<T>;
  /** Tool steps allowed before the answer is required. */
  toolSteps: number;
}

export interface TurnResult<T> {
  value: T;
  /** Everything the seat was shown, for the fact check. */
  seen: string[];
}

export function seatBlock(seat: Seat): string {
  return [
    `You are the ${seat.title} seat (${seat.institution}) on Malaysia's National Disaster Management Committee.`,
    "You are role-played by an AI. Speak as the office, never as a named person.",
    `Your mandate: ${seat.mandate}`,
    `Only you have been told: ${seat.brief}`,
    `Voice: ${seat.voice}. The voice is in your words, never in place of evidence.`,
  ].join("\n");
}

export async function runTurn<T>(deps: TurnDeps, spec: TurnSpec<T>): Promise<TurnResult<T>> {
  const { seat } = spec;
  const Step = z.object({
    action: z.enum(["tools", "final"]),
    /** One line the replay shows as what this seat is weighing. */
    gist: z.string().max(240).default(""),
    calls: z.array(Call).max(MAX_CALLS).default([]),
    answer: spec.answer.optional(),
  });
  // On the last step the schema itself has no calls and requires the answer: told in words, seats still asked for tools (run 1).
  const LastStep = z.object({ action: z.literal("final").default("final"), gist: z.string().max(240).default(""), calls: z.array(Call).max(0).default([]), answer: spec.answer });
  const system = spec.prompt.text.replace("{{seat}}", seatBlock(seat)).replace("{{tools}}", councilToolDescriptions(seat.tools));
  const skills = seat.skills.map((name) => councilSkills().get(name)).filter((skill) => skill !== undefined);
  for (const skill of skills) {
    const callId = `${seat.id}-skill-${skill.name}`;
    await deps.emit.emit("tool_call", seat.id, { callId, agent: seat.id, tool: "load_skill", args: { name: skill.name } });
    await deps.emit.emit("tool_result", seat.id, { callId, agent: seat.id, ok: true, preview: `${skill.name} v${skill.version}` });
  }
  const done: string[] = [];
  const seen = [system, ...Object.values(spec.input).flat(), ...skills.map(skillText)];

  for (let step = 0; ; step++) {
    const last = step >= spec.toolSteps;
    const { value } = await callStructured<z.infer<typeof Step>>(deps, {
      prompt: { ...spec.prompt, text: system, model: seat.model },
      input: {
        ...(skills.length ? { "Skills you have read": skills.map(skillText).join("\n\n") } : {}),
        ...spec.input,
        "What you have looked up": done.length ? done.join("\n\n") : "(nothing yet)",
        ...(last ? { Now: "This is your last step: no more tools. Answer with action: final and your answer." } : {}),
      },
      schema: last ? LastStep : Step,
      project: "council",
      conversationId: null,
      defaultsOptional: true,
    });
    if (value.gist.trim()) await deps.emit.emit("thinking", seat.id, { agent: seat.id, gist: value.gist.trim() });
    if (value.action === "final" || last || value.calls.length === 0) {
      if (value.answer !== undefined) return { value: value.answer, seen };
      if (last) throw new TerminalError(`${seat.title} gave no answer on its last step`);
      done.push("### you gave no answer\nAnswer with action: final, or make the calls you still need.");
      continue;
    }
    for (const [index, call] of value.calls.entries()) {
      const callId = `${seat.id}-${step}-${index}`;
      await deps.emit.emit("tool_call", seat.id, { callId, agent: seat.id, tool: call.tool, args: call.args });
      const result = callCouncilTool(call.tool, call.args, seat.tools, deps.ctx);
      await deps.emit.emit("tool_result", seat.id, { callId, agent: seat.id, ok: result.ok, preview: result.preview });
      done.push(`### you called ${call.tool} ${JSON.stringify(call.args)}\n${result.ok ? "" : "(it did not work) "}${result.text}`);
      seen.push(result.text);
    }
  }
}
