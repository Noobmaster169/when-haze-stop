import type { ScenarioName } from "../contracts.council";

/**
 * How fast fires go out, in three scenarios. Every plan is scored in all three,
 * because the ranges in the literature are as wide as the wind's.
 *
 * Sources (docs/council/research/01-suppression-science.md): ground lance teams
 * extinguish 0.25 to 3 ha of smouldering peat a team-day in field reports;
 * half-suppressed peat relights; aircraft knock down surface flame and do not
 * extinguish peat. The active area behind one satellite detection and the
 * aircraft's hectares of surface fire are our assumptions from those figures.
 */

export interface Scenario {
  name: ScenarioName;
  /** Hectares of active front behind one VIIRS detection. */
  haPerDetection: number;
  /** Hectares of smouldering peat one lance team extinguishes in a day. */
  teamHaPerDay: number;
  /** Ground crews work this many times faster on surface fire on mineral soil. */
  surfaceSpeedup: number;
  /** Share of extinguished peat that relights once the crews leave. */
  relapse: number;
  /** Extra share kept burning in a complex with unsuppressed fire close by. */
  neighbourRelapse: number;
  /** Hectares of surface fire one CL-415 knocks down in a working day. */
  scooperHaPerDay: number;
  /** The same for one helicopter with a bucket. */
  helicopterHaPerDay: number;
  /** Share of a peat fire's emissions that is surface flame aircraft can knock down while overhead. */
  flamingShare: number;
}

export const SCENARIOS: Record<ScenarioName, Scenario> = {
  optimistic: {
    name: "optimistic",
    haPerDetection: 0.3,
    teamHaPerDay: 3,
    surfaceSpeedup: 3,
    relapse: 0.1,
    neighbourRelapse: 0.1,
    scooperHaPerDay: 15,
    helicopterHaPerDay: 2,
    flamingShare: 0.4,
  },
  central: {
    name: "central",
    haPerDetection: 1,
    teamHaPerDay: 1,
    surfaceSpeedup: 3,
    relapse: 0.3,
    neighbourRelapse: 0.2,
    scooperHaPerDay: 9,
    helicopterHaPerDay: 1.1,
    flamingShare: 0.3,
  },
  pessimistic: {
    name: "pessimistic",
    haPerDetection: 3,
    teamHaPerDay: 0.25,
    surfaceSpeedup: 2,
    relapse: 0.6,
    neighbourRelapse: 0.3,
    scooperHaPerDay: 3,
    helicopterHaPerDay: 0.5,
    flamingShare: 0.2,
  },
};

/** A complex counts as peat when this share of its cells is on the peat map, or it has smouldered this long. */
export const PEAT_SHARE = 0.3;
export const PEAT_PERSISTENCE_DAYS = 7;
