import { TerminalError } from "../../../lib/errors";
import { childLogger } from "../../../lib/logger";
import { loadPrompt } from "../../prompts/registry";
import type { BoardPlan } from "../context";
import { PROPOSERS, type Seat } from "../seats";
import { runTurn } from "../turn";
import { DraftAnswer } from "./answers";
import { join } from "./join";
import { say } from "./say";
import { describePlan, type Session } from "./session";

/**
 * Stage 2: every proposer drafts one plan under its premise, blind to the
 * others. A plan the validator refuses goes back to its author once with the
 * reasons. Four of six drafts are needed to go on.
 */

export const DRAFT_PROMPT = "v4";
const QUORUM = 4;
const log = childLogger({ module: "council.drafts" });

async function table(session: Session, proposer: Seat, draft: DraftAnswer, seen: string[]): Promise<BoardPlan> {
  const { headline, ...plan } = draft;
  const entry = session.deps.ctx.table({ by: proposer.id, premise: session.premises.get(proposer.id) ?? null, plan });
  await session.deps.emit.emit("candidate", proposer.id, {
    planId: entry.id,
    by: proposer.id,
    premise: entry.premise,
    title: entry.plan.title,
    headline,
    assignments: entry.plan.assignments,
    requests: entry.plan.requests,
    share: entry.plan.share,
    rationale: entry.plan.rationale,
    violations: entry.violations,
    baseline: false,
  });
  // A seat's own units and days are its decisions, not claims to check.
  await say(session.deps, { from: proposer.id, to: ["chair"], act: "propose", headline, detail: entry.plan.rationale, planId: entry.id, seen: [...seen, JSON.stringify(draft)] });
  return entry;
}

async function draftOne(session: Session, proposer: Seat): Promise<BoardPlan> {
  const prompt = loadPrompt("council-draft", DRAFT_PROMPT);
  const mission = session.mission!;
  const input = {
    "Fact sheet": session.facts,
    "The Chair's mission": `${mission.objective}\n${mission.openingBrief}`,
    "Your premise": session.premises.get(proposer.id) ?? "",
  };
  const first = await runTurn(session.deps, { seat: proposer, prompt, input, answer: DraftAnswer, toolSteps: 2 });
  session.turns += 1;
  const entry = await table(session, proposer, first.value, first.seen);
  if (entry.violations.length === 0) return entry;

  await say(session.deps, {
    from: "engine",
    to: [proposer.id],
    act: "challenge",
    headline: `This plan cannot be carried out as written: ${entry.violations[0].message}.`,
    detail: entry.violations.map((item) => item.message).join("\n"),
    planId: entry.id,
    seen: [],
  });
  const repaired = await runTurn(session.deps, {
    seat: proposer,
    prompt,
    input: { ...input, "Your plan was refused": `${describePlan(entry)}\nFix every problem and keep the plan's intent.` },
    answer: DraftAnswer,
    toolSteps: 1,
  });
  session.turns += 1;
  return table(session, proposer, repaired.value, repaired.seen);
}

export async function drafts(session: Session): Promise<void> {
  await join(session, PROPOSERS.map((item) => item.id));
  const settled = await Promise.allSettled(PROPOSERS.map((proposer) => draftOne(session, proposer)));
  const failed = settled.flatMap((result, index) => (result.status === "rejected" ? [`${PROPOSERS[index].id}: ${String(result.reason)}`] : []));
  for (const failure of failed) log.warn({ failure }, "a seat failed to draft");
  if (settled.length - failed.length < QUORUM) throw new TerminalError(`only ${settled.length - failed.length} of ${PROPOSERS.length} seats drafted a plan; ${QUORUM} are needed (${failed.join("; ")})`);
}
