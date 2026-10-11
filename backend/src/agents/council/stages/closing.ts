import { z } from "zod";

import { childLogger } from "../../../lib/logger";
import { loadPrompt } from "../../prompts/registry";
import { SEATS } from "../seats";
import { runTurn } from "../turn";
import { say } from "./say";
import type { Session } from "./session";

/**
 * After the decision, every member says in front of the room whether they
 * stand behind it. The rule decides; this is where the replay shows who
 * agreed and who did not, and why, instead of implying a consensus that the
 * scores alone produced.
 */

export const CLOSE_PROMPT = "v1";
const log = childLogger({ module: "council.closing" });

const ClosingAnswer = z.object({
  headline: z.string().min(1).max(240).describe("One plain sentence: where you stand and why."),
  stance: z.enum(["support", "dissent"]),
  reason: z.string().max(400),
});

export async function closing(session: Session, decision: string): Promise<void> {
  const members = SEATS.filter((seat) => seat.id !== "chair");
  const settled = await Promise.allSettled(
    members.map(async (member) => {
      const { value, seen } = await runTurn(session.deps, {
        seat: member,
        prompt: loadPrompt("council-close", CLOSE_PROMPT),
        input: { "The decision": decision },
        answer: ClosingAnswer,
        toolSteps: 0,
      });
      session.turns += 1;
      await say(session.deps, { from: member.id, to: ["chair"], act: value.stance === "support" ? "support" : "dissent", headline: value.headline, detail: value.reason, seen });
    }),
  );
  for (const result of settled) if (result.status === "rejected") log.warn({ err: String(result.reason) }, "a member did not give a closing word");
}
