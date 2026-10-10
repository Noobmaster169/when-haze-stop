import type { Guideline } from "../contracts";

/**
 * The official lines, and what crossing each one means.
 *
 * Only rules a Malaysian authority has published are here, each with where it
 * was reported. WHO limits are concentrations, and DOE publishes only the
 * index, so they cannot be applied to these readings. There is no national
 * line for events: the assistant says so when asked about one.
 */

const MOE_2026 =
  "https://www.malaymail.com/news/malaysia/2026/10/08/schools-in-malaysia-to-close-from-tomorrow-if-haze-index-tops-180-education-ministry-says/238300";
const HEALTH_2026 = "https://www.theborneopost.com/2026/08/31/haze-and-health-when-is-it-too-dangerous-to-carry-on/";

export const GUIDELINES: Guideline[] = [
  {
    threshold: 100,
    sustainedDays: null,
    audience: "Schools",
    action: "Outdoor activities stop and outdoor sports are postponed.",
    issuer: "Ministry of Education",
    source: HEALTH_2026,
  },
  {
    threshold: 100,
    sustainedDays: null,
    audience: "Public and employers",
    action: "Limit strenuous outdoor activity. Children, older adults and people with heart or lung conditions limit time outdoors.",
    issuer: "Ministry of Health",
    source: HEALTH_2026,
  },
  {
    threshold: 150,
    sustainedDays: 3,
    audience: "Schools",
    action: "Schools close after three days in a row above 150 (from 12 October 2026).",
    issuer: "Ministry of Education",
    source: MOE_2026,
  },
  {
    threshold: 180,
    sustainedDays: null,
    audience: "Schools",
    action: "Schools close (from 9 October 2026).",
    issuer: "Ministry of Education",
    source: MOE_2026,
  },
  {
    threshold: 200,
    sustainedDays: null,
    audience: "Employers",
    action: "Avoid strenuous outdoor work.",
    issuer: "Ministry of Health",
    source: HEALTH_2026,
  },
];

/** The lines themselves, lowest first: what the map marks and the alerts watch. */
export const LINES = [...new Set(GUIDELINES.map((guideline) => guideline.threshold))].sort((a, b) => a - b);

/** Malaysia's own bands for the index. */
export function band(api: number): string {
  if (api <= 50) return "Good";
  if (api <= 100) return "Moderate";
  if (api <= 200) return "Unhealthy";
  if (api <= 300) return "Very unhealthy";
  return "Hazardous";
}
