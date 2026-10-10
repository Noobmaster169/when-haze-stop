import { childLogger } from "../../../lib/logger";
import { loadPrompt } from "../../prompts/registry";
import { seat } from "../seats";
import { runTurn } from "../turn";
import { RatingAnswer, type Weights } from "./answers";
import { describePlan, type Session } from "./session";

/**
 * Stage 7: the criteria the engine cannot score, each rated only by the seats
 * that own it, blind to authorship and in a different order for each rater (an
 * LLM judge favours what it reads first). The engine's own criteria come from
 * the scores. The matrix and its weights decide; the mood of the room does not.
 */

export const RATE_PROMPT = "v1";
const log = childLogger({ module: "council.comparison" });

export const RATERS: Record<Exclude<keyof Weights, "klBenefit" | "robustness">, string[]> = {
  feasibility: ["force_command", "air_operations", "domestic_fire", "peat_science"],
  diplomacy: ["foreign_affairs"],
  cost: ["treasury"],
  sideBenefits: ["sarawak", "health"],
};

const CRITERION_WORDS: Record<keyof typeof RATERS, string> = {
  feasibility: "feasibility and crew risk: can it actually be done, safely, and will what it puts out stay out",
  diplomacy: "diplomatic acceptability to Indonesia and within ASEAN",
  cost: "value for money",
  sideBenefits: "benefit beyond KL: Sarawak, and people's health across the country",
};

function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let state = seed + 1;
  for (let index = out.length - 1; index > 0; index--) {
    state = (state * 1103515245 + 12345) % 2147483648;
    const pick = state % (index + 1);
    [out[index], out[pick]] = [out[pick], out[index]];
  }
  return out;
}

async function rate(session: Session, rater: string, criterion: keyof typeof RATERS, order: number): Promise<void> {
  const plans = shuffled(session.shortlist.map((id) => session.deps.ctx.plan(id)!), order);
  const { value } = await runTurn(session.deps, {
    seat: seat(rater)!,
    prompt: loadPrompt("council-rate", RATE_PROMPT),
    input: { "Your criterion": CRITERION_WORDS[criterion], "The plans (authors hidden)": plans.map(describePlan).join("\n\n") },
    answer: RatingAnswer,
    toolSteps: 0,
  });
  session.turns += 1;
  session.ratings.push({ by: rater, answer: value });
  await session.deps.emit.emit("vote", rater, { agent: rater, ratings: value.ratings.map((item) => ({ planId: item.planId, score: item.score, note: item.note })) });
}

export async function comparison(session: Session): Promise<void> {
  const jobs = Object.entries(RATERS).flatMap(([criterion, raters]) => raters.map((rater) => ({ rater, criterion: criterion as keyof typeof RATERS })));
  const settled = await Promise.allSettled(jobs.map((job, index) => rate(session, job.rater, job.criterion, index)));
  for (const result of settled) if (result.status === "rejected") log.warn({ err: String(result.reason) }, "a rating failed");
}

export interface MatrixRow {
  planId: string;
  scores: Record<keyof Weights, number>;
  weighted: number;
}

/** Every shortlisted plan on every criterion, 0 to 1, and the weighted total. A criterion nobody rated counts as middling. */
export function matrix(session: Session): MatrixRow[] {
  const plans = session.shortlist.map((id) => session.deps.ctx.plan(id)!);
  const best = (pick: (index: number) => number) => Math.max(1e-9, ...plans.map((_, index) => pick(index)));
  const expected = best((index) => plans[index].score.expected);
  const worst = best((index) => plans[index].score.worstWind);
  const pessimistic = best((index) => plans[index].score.pessimistic);
  const weights = session.mission!.weights;
  return plans
    .map((plan) => {
      const rated = (criterion: keyof typeof RATERS) => {
        const scores = session.ratings.filter((item) => RATERS[criterion].includes(item.by)).flatMap((item) => item.answer.ratings.filter((rating) => rating.planId === plan.id).map((rating) => rating.score));
        return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length / 10 : 0.5;
      };
      const scores = {
        klBenefit: plan.score.expected / expected,
        robustness: 0.5 * (plan.score.worstWind / worst) + 0.5 * (plan.score.pessimistic / pessimistic),
        feasibility: rated("feasibility"),
        diplomacy: rated("diplomacy"),
        cost: rated("cost"),
        sideBenefits: rated("sideBenefits"),
      };
      const weighted = (Object.keys(scores) as (keyof Weights)[]).reduce((sum, key) => sum + weights[key] * scores[key], 0);
      return { planId: plan.id, scores, weighted };
    })
    .sort((a, b) => b.weighted - a.weighted);
}
