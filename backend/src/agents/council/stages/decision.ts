import type { Verdict } from "../../../contracts";
import { TerminalError } from "../../../lib/errors";
import { loadPrompt } from "../../prompts/registry";
import { SEATS, seat } from "../seats";
import { runTurn } from "../turn";
import { DecisionAnswer } from "./answers";
import { closing } from "./closing";
import { BAR, matrix } from "./comparison";
import { say } from "./say";
import { describePlan, type Session } from "./session";
import { buildVerdict } from "./verdict";

/**
 * Stage 8: the rule picks the plan; the Chair explains it. The Chair cannot
 * pick another plan, so the verdict is the frozen criteria's and not the
 * loudest seat's. It writes the three tracks, the reasoning, the minority
 * report and what would make the Committee meet again.
 */

export const DECIDE_PROMPT = "v4";

export async function decision(session: Session): Promise<Verdict> {
  const rows = matrix(session);
  const chosen = rows[0] ? session.deps.ctx.plan(rows[0].planId) : undefined;
  if (!chosen) throw new TerminalError("no feasible plan reached the decision");
  // Rows come eligible first, so the first row is the winner either way; when none clears the bar the best score stands, and the Chair says so.
  const table = rows.map((row) => `${row.planId}: weighted ${row.weighted.toFixed(3)}${row.eligible ? "" : ` (barred: rated below ${10 * BAR} of 10 on feasibility or diplomacy)`} | ${Object.entries(row.scores).map(([key, value]) => `${key} ${value.toFixed(2)}`).join(", ")}`);
  const baselines = session.deps.ctx.plans().filter((plan) => plan.baseline);
  const against = session.critiques.filter((item) => item.planId === chosen.id).map((item) => `${seat(item.by)?.title} (${item.answer.verdict}): ${item.answer.strongestObjection}`);
  const premortem = session.premortem?.premortems.find((item) => item.planId === chosen.id);

  const { value, seen } = await runTurn(session.deps, {
    seat: seat("chair")!,
    prompt: loadPrompt("council-decide", DECIDE_PROMPT),
    input: {
      "Your mission, frozen": `${session.mission!.objective}\nWeights: ${JSON.stringify(session.mission!.weights)}`,
      "The matrix, best first": table,
      "The plan the rule chose": describePlan(chosen),
      "The other plans": rows.slice(1).map((row) => describePlan(session.deps.ctx.plan(row.planId)!)).join("\n\n") || "(none)",
      "Plans made by code without the council": baselines.map(describePlan).join("\n\n"),
      "What was said against the chosen plan": [...against, premortem ? `Red Cell: ${premortem.failure}` : ""].filter(Boolean),
      "Fact sheet": session.facts,
    },
    answer: DecisionAnswer,
    toolSteps: 0,
  });
  session.turns += 1;
  await say(session.deps, {
    from: "chair",
    to: SEATS.filter((item) => item.id !== "chair").map((item) => item.id),
    act: "decide",
    headline: value.headline,
    detail: [`Act now: ${value.actNow}`, `Ask: ${value.ask}`, `Share: ${value.share}`, value.reasoning, `Minority report: ${value.minorityReport}`].join("\n\n"),
    planId: chosen.id,
    seen,
  });
  await closing(session, [value.headline, `Do now: ${value.actNow}`, `Ask Indonesia for: ${value.ask}`, `Tell Indonesia: ${value.share}`, value.reasoning].join("\n\n"));
  await session.deps.emit.emit("verdict", "chair", { planId: chosen.id });
  return buildVerdict(session, chosen, value);
}
