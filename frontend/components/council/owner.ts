import type { CouncilEvent } from "@/lib/api/council-schemas";

/** The agent an event belongs to, for the events one agent does. */
export function ownerOf(event: CouncilEvent): string | null {
  switch (event.kind) {
    case "thinking":
    case "tool_call":
    case "tool_result":
    case "vote":
      return event.payload.agent;
    case "message":
      return event.payload.from;
    case "candidate":
      return event.payload.by;
    case "simulation":
      return "engine";
    case "verdict":
      return event.actor;
    default:
      return null;
  }
}
