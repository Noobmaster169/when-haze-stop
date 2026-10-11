import { config } from "../../config";
import type { ChatProgress, ChatToolCall } from "../../contracts";
import { CallAbortedError } from "../../lib/errors";
import { childLogger } from "../../lib/logger";
import { loadPrompt } from "../prompts/registry";
import { callStructured, type StructuredDeps } from "../structured";
import { finish, type FinishedCall, forWire, Step, transcribe } from "./loop.steps";
import { valueSoFar } from "./partial";
import { skillCards, skills, skillText } from "./skills/registry";
import { callTool, toolDescriptions, type ToolContext } from "./tools";

const log = childLogger({ module: "chat.loop" });

/**
 * The agent's turn: read the question, look, answer.
 *
 * Tool use is a JSON protocol rather than a provider's tool-call API, because
 * every call goes through the proxy to `claude -p` and the wire between them
 * carries text. One step per model call, each step either up to four tool
 * calls run together or the final answer, each one a row in `llm_calls`.
 * What one step may say is `loop.steps.ts`.
 */

/** Two or three steps answer most questions; the rest is room to recover from a refusal. */
const MAX_STEPS = 8;
const CHAT_PROMPT = "v5";

export interface TurnInput {
  conversationId: string;
  question: string;
  /** Oldest first: what the person asked and what the agent answered before now. */
  history: { role: "user" | "assistant"; content: string }[];
  /** ISO date. The prompt file never holds it. */
  today: string;
  /** Skills loaded earlier in this conversation, which stay in front of the agent. */
  stickySkills: string[];
}

export interface LoopDeps extends StructuredDeps {
  tools: Omit<ToolContext, "conversationId" | "signal">;
  /** Called with a step's finished calls, before the next model call. Awaited. */
  onStep?(calls: ChatToolCall[]): Promise<void> | void;
  /**
   * Where the turn has got to, called as it gets there.
   *
   * Not awaited: a progress event is a repaint of something that is about to
   * be replaced anyway, so one that arrives late or not at all costs a frame
   * and never an answer.
   */
  onProgress?(progress: ChatProgress): void;
}

export interface TurnResult {
  answer: string;
  toolCalls: ChatToolCall[];
  skillsUsed: string[];
  /** The loop ran out of steps before it had an answer. */
  exhausted: boolean;
  /** The person stopped the turn; `answer` is what had been written by then. */
  stopped: boolean;
}

function renderHistory(history: TurnInput["history"]): string {
  if (history.length === 0) return "(this is the first message)";
  return history.map((turn) => `${turn.role === "user" ? "Person" : "You"}: ${turn.content}`).join("\n\n");
}

export async function runTurn(deps: LoopDeps, input: TurnInput): Promise<TurnResult> {
  const prompt = loadPrompt("chat", CHAT_PROMPT, config.LLM_MODEL_CHAT);
  const system = prompt.text.replace("{{tools}}", toolDescriptions()).replace("{{skills}}", skillCards());
  const tools: ToolContext = { ...deps.tools, conversationId: input.conversationId, signal: deps.signal };

  const calls: FinishedCall[] = [];
  const loaded = new Set(input.stickySkills.filter((name) => skills().has(name)));
  /** Things the model is told about its own steps that are not tool calls, so they never reach the page as one. */
  const notes: string[] = [];
  /** The furthest any step's answer has been shown, which is what a stopped turn keeps. */
  let shownAnswer = "";

  const result = (answer: string, flags: { exhausted?: boolean; stopped?: boolean } = {}): TurnResult => ({
    answer,
    toolCalls: calls.map(forWire),
    skillsUsed: [...loaded],
    exhausted: flags.exhausted ?? false,
    stopped: flags.stopped ?? false,
  });

  /**
   * What the step in flight has written so far, as the page needs it.
   *
   * `claude -p` sends the whole object a second time in a second content
   * block, so the preview drops to empty partway through and writes nearly the
   * same answer again. Blanking the page and retyping it is the worst way to
   * spend that moment, so the preview only ever moves forward.
   */
  const watch = (step: number) => {
    let last = "";
    shownAnswer = "";
    return (soFar: string) => {
      const answer = valueSoFar(soFar, "answer");
      if (answer.length >= shownAnswer.length) shownAnswer = answer;
      if (shownAnswer === last) return;
      last = shownAnswer;
      deps.onProgress?.({ step, phase: "writing", answer: shownAnswer, tools: [] });
    };
  };

  try {
    for (let step = 1; step <= MAX_STEPS; step++) {
      deps.onProgress?.({ step, phase: "reading", answer: "", tools: [] });
      const { value } = await callStructured(deps, {
        prompt: { ...prompt, text: system },
        input: {
          Today: input.today,
          "Conversation so far": renderHistory(input.history),
          "Skills loaded": loaded.size > 0 ? [...loaded].map((name) => skillText(skills().get(name)!)).join("\n\n") : "(none)",
          "What you have done on this turn": calls.length > 0 ? calls.map(transcribe).join("\n\n") : "(nothing yet)",
          ...(notes.length > 0 ? { Notes: notes.join("\n\n") } : {}),
          Question: input.question,
        },
        schema: Step,
        project: "chat",
        conversationId: input.conversationId,
        // One flat schema stands for two shapes, so half its fields belong to
        // whichever shape this step is not. Told they are required, the model
        // writes all of them every time.
        defaultsOptional: true,
        onPreview: deps.onProgress ? watch(step) : undefined,
      });

      if (value.action === "final") {
        if (value.answer.trim() !== "") return result(value.answer);
        notes.push("### you gave a final step with no answer\nWrite the answer in `answer`, or make the calls you still need.");
        log.warn({ step }, "a chat step was final and said nothing");
        continue;
      }

      // A tool step that carries no call is the one shape the flat schema lets
      // through and a union would not have.
      if (value.calls.length === 0) {
        notes.push("### you asked for a tool step and gave no calls\nPut one to four calls in `calls`, or answer with action: final.");
        log.warn({ step }, "a chat step asked for tools without naming any");
        continue;
      }

      // The tools are named before they run rather than after, because running
      // them is the part with the seconds in it.
      deps.onProgress?.({ step, phase: "looking", answer: "", tools: value.calls.map((call) => call.tool) });

      const finished = await Promise.all(
        value.calls.map(async (call) => {
          const started = Date.now();
          const outcome = await callTool(call.tool, call.args, tools);
          return finish(call, outcome, Date.now() - started);
        }),
      );
      for (const call of finished) {
        if (call.skill) loaded.add(call.skill);
        log.info({ step, tool: call.tool, ok: call.ok, durationMs: call.durationMs }, "chat tool call");
      }
      calls.push(...finished);
      if (deps.onStep) await deps.onStep(finished.map(forWire));
      if (deps.signal?.aborted) return result("", { stopped: true });
    }
  } catch (error) {
    // Stop is not a failure: the turn ends with whatever it had written, and
    // the tool calls it made are still on the page.
    if (error instanceof CallAbortedError) return result(shownAnswer, { stopped: true });
    throw error;
  }

  // The budget is spent. Saying so beats a made-up answer, and beats an error:
  // the tool results are on the page either way.
  log.warn({ steps: MAX_STEPS, question: input.question.slice(0, 120) }, "the chat loop ran out of steps");
  return result(`I ran out of steps before I had an answer (${MAX_STEPS} steps, ${calls.length} tool calls). What I looked at is listed below; try asking a narrower question.`, {
    exhausted: true,
  });
}
