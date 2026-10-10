import type { Chapter } from "@/components/simulation/chapters";

/**
 * The Model page's chapters, each one figure: what is forecast and from what, the verdict, what goes in, how
 * close it gets, the 150 line, whether it sees change, every instrument's
 * score, and the limits. The summary is the figure's one-line caption; the
 * table of contents and the headings both read this list.
 */

export const MODEL_SCROLL_ID = "model-scroll";

export const MODEL_CHAPTERS: Chapter[] = [
  { id: "live", title: "Live record", summary: "Whose forecast is showing, how it is scoring as days come due, the stations it puts highest tomorrow, and every scored forecast." },
  {
    id: "data",
    title: "What is being forecast",
    summary: "The air quality number Malaysia publishes, the readings and satellites behind it, and the three forecasts compared on every chart.",
  },
  { id: "verdict", title: "The verdict", summary: "Months it never saw, at every instrument it serves, against tomorrow equals today." },
  { id: "inputs", title: "What goes in", summary: "600 small trees over 108 numbers known at 08:00; one real row from Shah Alam." },
  { id: "error", title: "How close, every station-day", summary: "How far the next-day peak missed, in steps of 5 µg/m³: more days in the first bin, fewer in the tail." },
  { id: "crossings", title: "Crossing the 150 line", summary: "Every next-day crossing of API 150: how many each forecast caught, missed, and called wrongly." },
  { id: "change", title: "Does it predict change?", summary: "Direction mostly right, size too small; then every station, every day." },
  { id: "scorecard", title: "Scorecard", summary: "Every instrument; model / no change (tomorrow = today), green where the model does better, red where worse." },
  { id: "limits", title: "Limits", summary: "What it does not do yet, and the gate before anyone sees it." },
];
