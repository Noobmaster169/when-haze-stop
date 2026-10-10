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
    brief: "Political guidance: the Committee will be asked what Malaysia did this week. The package was accepted for Kalimantan on 18 September 2026 and procedures were still being aligned on 7 October.",
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
    mandate: "Lower the API over Kuala Lumpur and its surroundings.",
    brief: "Schools closed in KL, Putrajaya, Selangor, Johor, Melaka, Negeri Sembilan and Pahang on 9 October 2026. You hold the target's readings and forecast, and the ceiling.",
    tools: [...READ, "get_target_air"],
    skills: ["reading-influence"],
    voice: "policy-minded, direct",
    model: "sonnet",
    premise: "Best for KL if Indonesia agrees to every request.",
  },
  {
    id: "meteorology",
    kind: "seat",
    title: "Meteorology",
    institution: "MetMalaysia",
    mandate: "Say where the smoke goes and how sure that is.",
    brief: "MetMalaysia declared the inter-monsoon from 9 October 2026: weak, variable winds and afternoon storms that scrub smoke. Past the forecast, each wind member replays a past window; they disagree most about Sumatra against Kalimantan.",
    tools: [...READ, "get_wind_outlook"],
    skills: ["reading-influence"],
    voice: "precise, probabilistic",
    model: "sonnet",
    premise: "Robust: the best result in the worst wind member.",
  },
  {
    id: "peat_science",
    kind: "seat",
    title: "Peat Science",
    institution: "University tropical peat research",
    mandate: "Physical realism about what can be put out and what relights.",
    brief: "The engine burns fire power as mass, which under-weights smouldering peat by 3 to 6 times per kg burned. A high night share with many days burning marks deep smouldering. No open map gives peat depth.",
    tools: READ,
    skills: ["peat-suppression"],
    voice: "hedged, specific, cites mechanisms",
    model: "sonnet",
    premise: "Peat physics first: commit only to what can actually be finished.",
  },
  {
    id: "force_command",
    kind: "seat",
    title: "Force Command",
    institution: "NADMA operations",
    mandate: "Use the deployed force safely and well: concentrated, sustainable work over scattered sorties.",
    brief: "Crews need a rest day in seven. Smoke under 3 km visibility grounds aircraft. Ground teams need water within a few hundred metres. The 52 deployed are mostly air crew.",
    tools: [...READ, "get_logistics"],
    skills: ["peat-suppression", "aerial-firefighting"],
    voice: "operational, blunt",
    model: "sonnet",
    premise: "Within what Indonesia has accepted, nothing new asked.",
  },
  {
    id: "air_operations",
    kind: "seat",
    title: "Air Operations",
    institution: "APMM and TUDM",
    mandate: "Aircraft: what can fly where, and how often.",
    brief: "In October 2015 the CL-415 flew from Palembang and dropped about 165,000 L a day, then went home after about ten days for maintenance. It needs a 1.3 km open-water scoop run within about 25 km.",
    tools: [...READ, "get_logistics"],
    skills: ["aerial-firefighting"],
    voice: "technical, terse",
    model: "sonnet",
    premise: "Cheapest per ug/m3 removed.",
  },
  {
    id: "domestic_fire",
    kind: "seat",
    title: "Domestic Fire",
    institution: "Bomba (JBPM)",
    mandate: "Fires on Malaysian soil.",
    brief: "Bomba has about 15,000 staff already fighting local fires; up to 100 can be moved to the fires that matter within hours. Surface fires on mineral soil go out in a day or two with pumps and beaters.",
    tools: [...READ, "get_logistics"],
    skills: ["peat-suppression"],
    voice: "terse, practical",
    model: "sonnet",
    premise: "Domestic first: what Malaysia controls today.",
  },
  {
    id: "health",
    kind: "seat",
    title: "Health",
    institution: "Ministry of Health (KKM)",
    mandate: "Fewer people breathing unhealthy air, the vulnerable first.",
    brief: "Sentinel asthma cases rose from 61 to 219 between epidemiological weeks 32 and 33 of 2026. Exposure is people times hours above a line, not a mean.",
    tools: [...READ, "get_target_air"],
    skills: ["exposure-and-health"],
    voice: "careful, people-first",
    model: "sonnet",
    premise: "Most people out of unhealthy air soonest.",
  },
  {
    id: "sarawak",
    kind: "seat",
    title: "Sarawak",
    institution: "Sarawak State Disaster Management Committee",
    mandate: "Sarawak's air, which took the worst API in Malaysia this year.",
    brief: "Serian reached API 521 and was declared an emergency on 4 September 2026. Kalimantan's fires are Sarawak's source; a plan that helps KL and Sarawak together serves the whole country.",
    tools: READ,
    skills: ["reading-influence"],
    voice: "frank, regional",
    model: "sonnet",
    premise: "KL and Sarawak together.",
  },
  {
    id: "foreign_affairs",
    kind: "seat",
    title: "Foreign Affairs",
    institution: "Wisma Putra",
    mandate: "Indonesian consent, ASEAN framing, no appearance of interference. You may oppose a plan on a hard constraint only.",
    brief: "Help was accepted for Kalimantan only. Since 2015 Indonesia has accepted only aircraft. In 2019 Jakarta rebuffed Malaysia by pointing at Malaysian-owned concessions; in 2023 it denied its haze reached Malaysia. Malaysia proposed a science-diplomacy initiative in August 2026: a request framed as joint science lands better than a demand.",
    tools: ["get_complexes", "get_complex", "get_consent_and_costs"],
    skills: ["transboundary-diplomacy"],
    voice: "careful, conditional",
    model: "sonnet",
    premise: null,
  },
  {
    id: "treasury",
    kind: "seat",
    title: "Treasury",
    institution: "Ministry of Finance",
    mandate: "Keep the operation inside the money the government has set aside, and spend each ringgit where it removes the most smoke.",
    brief: "Aircraft are the costliest line by far: the CL-415 alone is about RM 450,000 a working day and each helicopter about RM 100,000, while a Bomba firefighter at home is about RM 250 a day. Malaysia's haze losses were about RM 1.5 billion in 2013.",
    tools: ["get_complexes", "get_consent_and_costs", "simulate_plan"],
    skills: [],
    voice: "dry, numerate",
    model: "sonnet",
    premise: null,
  },
  {
    id: "red_cell",
    kind: "red",
    title: "Red Cell",
    institution: "Fire and weather, the adversary",
    mandate: "Find how each plan fails: a wind shift, re-ignition, smoke grounding aircraft, consent refused, a ranking resting on one wind member.",
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
