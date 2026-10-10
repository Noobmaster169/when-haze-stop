import type { AgentKind } from "../../contracts";

/**
 * Who sits at the table (docs/council/04-council-roles.md).
 *
 * Seats are named by office, never by the person holding it: the council's
 * words are role-played, and putting them in a real minister's mouth would
 * invent what a real person said. A persona label alone changes nothing about
 * a model's answers (docs/council/research/04), so each seat is defined by
 * what it is answerable for, what only it is told, and which tools it has.
 */

export interface Seat {
  id: string;
  kind: AgentKind;
  title: string;
  institution: string;
  mandate: string;
  /** Facts only this seat is handed at the start: the hidden profile that makes the debate worth having. */
  brief: string;
  tools: string[];
  /** Skills it reads before its first answer. */
  skills: string[];
  voice: string;
  /** A proxy alias. */
  model: "sonnet" | "opus";
  /** The premise it drafts under, if it proposes a plan. */
  premise: string | null;
}

const READ = ["get_complexes", "get_complex", "get_influence", "check_feasibility", "simulate_plan"];

export const SEATS: Seat[] = [
  {
    id: "chair",
    kind: "chair",
    title: "Chair",
    institution: "National Disaster Management Committee (NADMA secretariat)",
    mandate: "Run the meeting, freeze the criteria before any plan exists, and decide by the rule. Speak last; never propose.",
    brief: "The Committee will be asked what Malaysia did this week and what it cost. Indonesia lets every Malaysian aircraft and crew work wherever they are needed.",
    tools: ["get_complexes", "get_target_air"],
    skills: [],
    voice: "measured, procedural",
    model: "opus",
    premise: null,
  },
  {
    id: "air_quality",
    kind: "seat",
    title: "Air Quality",
    institution: "NRES / Department of Environment",
    mandate: "Lower the haze over Kuala Lumpur and its surroundings, and protect the people breathing it.",
    brief: "Schools closed in KL, Putrajaya, Selangor, Johor, Melaka, Negeri Sembilan and Pahang on 9 October 2026. You hold the target's readings and forecast, and how much any plan could clear at most.",
    tools: [...READ, "get_target_air"],
    skills: ["reading-influence", "exposure-and-health"],
    voice: "policy-minded, direct",
    model: "sonnet",
    premise: "Clear the most smoke from KL, whatever it takes inside the budget.",
  },
  {
    id: "meteorology",
    kind: "seat",
    title: "Meteorology",
    institution: "MetMalaysia",
    mandate: "Say where the smoke goes and how sure that is.",
    brief: "MetMalaysia declared the inter-monsoon from 9 October 2026: weak, variable winds and afternoon storms that scrub smoke. Past the forecast, each wind pattern replays a past window; they disagree most about Sumatra against Kalimantan.",
    tools: [...READ, "get_wind_outlook"],
    skills: ["reading-influence"],
    voice: "precise, probabilistic",
    model: "sonnet",
    premise: "Hold up in every wind pattern, not just the likeliest.",
  },
  {
    id: "peat_science",
    kind: "seat",
    title: "Peat Science",
    institution: "University tropical peat research",
    mandate: "Physical realism about what can be put out and what relights.",
    brief: "The smoke model counts fires by their heat, which under-weights smouldering peat by 3 to 6 times per kg burned. Fires burning many nights in a row are deep peat. No open map gives peat depth.",
    tools: READ,
    skills: ["peat-suppression"],
    voice: "hedged, specific, cites mechanisms",
    model: "sonnet",
    premise: "Commit only to fires that can actually be finished, and attack them from the edge.",
  },
  {
    id: "fire_operations",
    kind: "seat",
    title: "Fire Operations",
    institution: "Bomba (JBPM) with NADMA operations",
    mandate: "Ground crews, at home and abroad: put fires out safely and keep them out.",
    brief: "Bomba has about 15,000 staff; up to 100 can be moved to Malaysian fires within hours, and a 150-strong task force with pumps can be flown to Indonesia in about three days. Crews need a rest day in seven and water within a few hundred metres. Surface fires on mineral soil go out in a day or two; peat takes lances and days.",
    tools: [...READ, "get_logistics"],
    skills: ["peat-suppression"],
    voice: "terse, operational",
    model: "sonnet",
    premise: "Ground crews first, at home and abroad, where they can finish the job.",
  },
  {
    id: "air_operations",
    kind: "seat",
    title: "Air Operations",
    institution: "APMM and TUDM",
    mandate: "Aircraft: what can fly where, how often, and where they actually help.",
    brief: "In October 2015 the CL-415 flew from Palembang and dropped about 165,000 L a day, then went home after about ten days for maintenance. It needs a long open-water or river run within about 25 km. Smoke under 3 km visibility grounds aircraft.",
    tools: [...READ, "get_logistics"],
    skills: ["aerial-firefighting"],
    voice: "technical, terse",
    model: "sonnet",
    premise: "Aircraft only where they really work: young or surface fires near water.",
  },
  {
    id: "treasury",
    kind: "seat",
    title: "Treasury",
    institution: "Ministry of Finance",
    mandate: "Keep the operation inside the money set aside, and spend each ringgit where it removes the most smoke.",
    brief: "Aircraft are the costliest line by far: the CL-415 alone is about RM 450,000 a working day and each helicopter about RM 100,000, while a Bomba firefighter at home is about RM 250 a day. Malaysia's haze losses were about RM 1.5 billion in 2013.",
    tools: [...READ, "get_costs"],
    skills: [],
    voice: "dry, numerate",
    model: "sonnet",
    premise: "The most smoke cleared for each ringgit.",
  },
  {
    id: "red_cell",
    kind: "red",
    title: "Red Cell",
    institution: "Fire and weather, the adversary",
    mandate: "Find how each plan fails: a wind shift, re-ignition, smoke grounding aircraft, crews too few for the area, a result resting on one wind pattern.",
    brief: "You are judged on finding the failure that matters most, not on disagreeing.",
    tools: ["get_complexes", "get_complex", "get_influence", "stress_plan"],
    skills: ["peat-suppression", "reading-influence"],
    voice: "sharp, concrete",
    model: "opus",
    premise: null,
  },
];

export const seat = (id: string): Seat | undefined => SEATS.find((item) => item.id === id);
export const PROPOSERS = SEATS.filter((item) => item.premise !== null);
