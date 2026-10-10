import { seat } from "../seats";
import type { Session } from "./session";

/** Puts agents on the page the first time they act, so the council fills the room stage by stage. */
export async function join(session: Session, ids: string[]): Promise<void> {
  for (const id of ids) {
    if (session.joined.has(id)) continue;
    session.joined.add(id);
    const found = seat(id);
    if (id === "engine") {
      await session.deps.emit.emit("agent_joined", "system", { agent: "engine", kind: "engine", title: "Engine", institution: "The smoke model, as referee", parent: null });
      continue;
    }
    if (!found) continue;
    await session.deps.emit.emit("agent_joined", "system", { agent: id, kind: found.kind, title: found.title, institution: found.institution, parent: null });
  }
}
