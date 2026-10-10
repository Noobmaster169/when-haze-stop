import { childLogger } from "../../../lib/logger";
import { argsSignature } from "./args-signature";
import { createAlert } from "./create-alert";
import { getAirQuality } from "./get-air-quality";
import { getFires } from "./get-fires";
import { getForecast } from "./get-forecast";
import { getGuidelines } from "./get-guidelines";
import { getStatements } from "./get-statements";
import { getTime } from "./get-time";
import { getTrackRecord } from "./get-track-record";
import { getWind } from "./get-wind";
import { loadSkill } from "./load-skill";
import { type ChatTool, refused, type ToolContext, type ToolOutcome } from "./types";

const log = childLogger({ module: "chat.tools" });

export { refused };
export type { ChatTool, ToolContext, ToolOutcome } from "./types";

/**
 * The tools, and the one place they are named, in the order the agent should
 * reach for them. Adding a tool is a file beside this one and a line here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each tool has its own input type; the registry is keyed by name and the loop parses through the tool's own schema.
const ALL: ChatTool<any>[] = [getAirQuality, getForecast, getStatements, getGuidelines, getTrackRecord, getFires, getWind, createAlert, getTime, loadSkill];

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- as above.
export const TOOLS: ReadonlyMap<string, ChatTool<any>> = new Map(ALL.map((tool) => [tool.name, tool]));

export const TOOL_NAMES = [...TOOLS.keys()];

/** The tool list as the prompt shows it: what each does, then the exact arguments it takes. */
export function toolDescriptions(): string {
  return ALL.map((tool) => `- ${tool.name}: ${tool.description}\n  args: ${argsSignature(tool.schema)}`).join("\n");
}

/**
 * Parses the arguments through the tool's own schema and runs it.
 *
 * A validation failure comes back as a refused outcome rather than a throw,
 * because the loop's answer to bad arguments is to hand the model the reason
 * and let it try again.
 */
export async function callTool(name: string, args: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  const tool = TOOLS.get(name);
  if (!tool) return refused(`there is no tool named "${name}". The tools are: ${TOOL_NAMES.join(", ")}`);

  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
    return {
      ok: false,
      // The shape is repeated here because a model that guessed a name once guesses it again unless shown the right one.
      text: `Those arguments do not fit ${name}: ${problems.join("; ")}. It takes exactly: ${argsSignature(tool.schema)}`,
      preview: `bad arguments: ${problems[0]}`,
    };
  }
  try {
    return await tool.run(parsed.data, ctx);
  } catch (error) {
    // A tool that throws must not take the turn with it: the agent is told,
    // can try another way, and the page shows the failed call. Logged, because
    // it is ours to fix and not the model's.
    const reason = error instanceof Error ? error.message : String(error);
    log.warn({ tool: name, err: reason }, "a chat tool failed");
    return refused(`${name} failed: ${reason}`);
  }
}
