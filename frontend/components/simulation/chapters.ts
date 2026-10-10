/**
 * The Simulation page's chapters, in the order the argument runs: the answer,
 * how a run works, what it predicts, the proof, real cases, the checks, the
 * limits, then reference. The table of contents and the headings both read
 * this list, so they cannot drift apart.
 */

export interface Chapter {
  id: string;
  title: string;
  /** What the chapter shows, in one line. */
  summary: string;
}

export const CHAPTERS: Chapter[] = [
  { id: "answer", title: "Does it predict?", summary: "The short answer, from replaying every hour of the stored week." },
  { id: "run", title: "How one run works", summary: "From satellite fires and forecast wind to a map and a forecast, with the newest run's own figures." },
  { id: "number", title: "What it predicts", summary: "DOE's index is a 24-hour average of PM2.5 on very unequal bands, so the model works in µg/m³." },
  { id: "proof", title: "The backtest", summary: "Each forecast saw only readings up to its own hour, then was scored against what DOE published." },
  { id: "cases", title: "Haze arriving, replayed", summary: "The steepest crossings of 100 this week, picked by rule, wins and losses alike." },
  { id: "checks", title: "Each part checked", summary: "The wind, rain, index table and inputs, each against an outside measurement." },
  { id: "limits", title: "Limits and live record", summary: "Where it does not help, and how the live runs are scoring as they are checked." },
  { id: "lines", title: "Official lines and sources", summary: "The thresholds the map, alerts and assistant use, and where every number comes from." },
];
