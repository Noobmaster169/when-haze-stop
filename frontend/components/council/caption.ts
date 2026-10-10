import type { CouncilEvent } from "@/lib/api/council-schemas";

import type { Agent } from "./timeline";
import { listNames, percent, toolWords } from "./words";

/** The one plain line under the objective that says what is happening now. Pure. */

export function nameOf(agents: Agent[], id: string): string {
  if (id === "engine") return "The engine";
  if (id === "system") return "The council";
  return agents.find((agent) => agent.id === id)?.title ?? id.replaceAll("_", " ");
}

export function captionFor(event: CouncilEvent | null, agents: Agent[]): string {
  if (!event) return "The council has not met yet.";
  const name = (id: string) => nameOf(agents, id);
  switch (event.kind) {
    case "run_started":
      return `The council convenes to clear the haze over ${event.payload.targetName}.`;
    case "stage":
      return `Stage ${event.payload.index} of ${event.payload.of}: ${event.payload.title}.`;
    case "agent_joined":
      return event.payload.kind === "engine" ? "The engine takes the centre of the table." : `${event.payload.title} takes a seat.`;
    case "thinking":
      return `${name(event.payload.agent)} thinks it over.`;
    case "tool_call":
      return `${name(event.payload.agent)} ${toolWords(event.payload.tool)}.`;
    case "tool_result":
      return event.payload.ok ? `The answer comes back to ${name(event.payload.agent)}.` : `${name(event.payload.agent)}'s lookup did not work.`;
    case "message": {
      const message = event.payload;
      const from = name(message.from);
      const to = listNames(message.to.map(name), agents.length);
      const plan = message.planId ? `plan ${message.planId}` : to;
      switch (message.act) {
        case "propose":
          return `${from} proposes ${message.planId ? `plan ${message.planId}` : "a plan"}.`;
        case "challenge":
          return `${from} challenges ${plan}.`;
        case "support":
          return `${from} supports ${plan}.`;
        case "concede":
          return `${from} concedes to ${to}.`;
        case "revise":
          return `${from} revises ${message.planId ? `into plan ${message.planId}` : "its plan"}.`;
        case "decide":
          return `${from} announces the decision.`;
        case "question":
          return `${from} asks ${to}.`;
        case "answer":
          return `${from} answers ${to}.`;
        case "dissent":
          return `${from} dissents.`;
        default:
          return `${from} briefs ${to}.`;
      }
    }
    case "candidate":
      return event.payload.baseline ? `Code tables a plan to beat: ${event.payload.title}.` : `${name(event.payload.by)} tables plan ${event.payload.planId}.`;
    case "simulation":
      return `The engine scores plan ${event.payload.planId}: ${percent(event.payload.score.expected)} of the ceiling expected.`;
    case "vote":
      return `${name(event.payload.agent)} rates the plans.`;
    case "verdict":
      return `The council chooses plan ${event.payload.planId}.`;
    case "run_finished":
      return `The council rises after ${event.payload.calls} model calls.`;
    case "run_failed":
      return `The run stopped: ${event.payload.error}`;
  }
}
