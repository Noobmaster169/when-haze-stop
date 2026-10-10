import type { Chapter } from "@/components/simulation/chapters";

/**
 * The Model page's chapters, in the order the argument runs: the target, the
 * function, how it was tested, the scores, whether it sees change coming, its
 * weaknesses, then what it means for a person. The table of contents and the
 * headings both read this list.
 */

export const MODEL_SCROLL_ID = "model-scroll";

export const MODEL_CHAPTERS: Chapter[] = [
  { id: "target", title: "What it predicts", summary: "The highest 24-hour mean PM2.5 of the next day and the day after, at every instrument, issued at 08:00." },
  { id: "function", title: "The function, written out", summary: "A sum of 600 small decision trees over 108 numbers known at 08:00, and one real row run through it." },
  { id: "testing", title: "Loss and test design", summary: "Pinball loss weighted to hazy days, scored walk-forward month by month against three baselines." },
  { id: "results", title: "Results", summary: "Months it never saw, on the reference monitors, against no change, the current forecast and climatology." },
  { id: "change", title: "Does it predict change?", summary: "Station by station over the 2026 haze season: the direction mostly right, the size too small." },
  { id: "weaknesses", title: "What it does not do well", summary: "Timid on sharp changes, a band too narrow, little warning before an episode starts." },
  { id: "person", title: "What it changes for a person", summary: "Two days of usable warning, fewer false alarms, and a gate before anyone sees it." },
];
