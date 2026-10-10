import { loadPrompt } from "../../prompts/registry";
import { PROPOSERS, seat } from "../seats";
import { runTurn } from "../turn";
import { MissionAnswer, type Weights } from "./answers";
import { join } from "./join";
import { say } from "./say";
import type { Session } from "./session";

/**
 * Stage 1: the Chair freezes the objective, the weights of what the engine
 * cannot score, and one premise per proposer, before any plan exists. Blind
 * drafts converge when every seat reads the same sheet (docs/council/11), so
 * premises must differ: a duplicate falls back to the seat's default.
 */

export const MISSION_PROMPT = "v2";
const DEFAULT_WEIGHTS: Weights = { klBenefit: 0.45, robustness: 0.2, feasibility: 0.15, diplomacy: 0.1, cost: 0.05, sideBenefits: 0.05 };

function normalised(weights: Weights): Weights {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return DEFAULT_WEIGHTS;
  return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, value / total])) as Weights;
}

export async function mission(session: Session): Promise<void> {
  const chair = seat("chair")!;
  await join(session, ["chair", "engine"]);
  const { value, seen } = await runTurn(session.deps, {
    seat: chair,
    prompt: loadPrompt("council-mission", MISSION_PROMPT),
    input: {
      "Fact sheet": session.facts,
      "Seats that will draft, with their default premise": PROPOSERS.map((item) => `${item.id} (${item.title}): ${item.premise}`),
      "Default weights": JSON.stringify(DEFAULT_WEIGHTS),
    },
    answer: MissionAnswer,
    toolSteps: 1,
  });
  session.turns += 1;
  const weights = normalised(value.weights);
  session.mission = { ...value, weights };

  const used = new Set<string>();
  for (const proposer of PROPOSERS) {
    const asked = value.premises.find((item) => item.seat === proposer.id)?.premise.trim();
    const premise = asked && !used.has(asked.toLowerCase()) ? asked : proposer.premise!;
    used.add(premise.toLowerCase());
    session.premises.set(proposer.id, premise);
  }
  const weightLine = Object.entries(weights).map(([key, weight]) => `${key} ${weight.toFixed(2)}`).join(", ");
  await say(session.deps, {
    from: "chair",
    to: PROPOSERS.map((item) => item.id),
    act: "brief",
    headline: value.headline,
    detail: `${value.objective}\n\n${value.openingBrief}\n\nWeights, frozen: ${weightLine}. ${value.weightReasons}\n\nPremises: ${[...session.premises].map(([id, premise]) => `${seat(id)?.title}: ${premise}`).join("; ")}.`,
    seen,
  });
}
