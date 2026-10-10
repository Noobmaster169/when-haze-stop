import type { AlertKind, HeadlineTone } from "@/lib/api/alert-schemas";

/** How each kind of alert is dressed and named: an official order is the loud one, clearing the calm one. */
export const TONE: Record<AlertKind, { label: string; text: string; dot: string; edge: string }> = {
  order: { label: "Official", text: "text-fault", dot: "bg-fault", edge: "border-l-fault" },
  arriving: { label: "Forecast", text: "text-differ", dot: "bg-differ", edge: "border-l-differ" },
  clearing: { label: "Clearing", text: "text-match", dot: "bg-match", edge: "border-l-match" },
  observed: { label: "Now", text: "text-ink-secondary", dot: "bg-ink-tertiary", edge: "border-l-hairline-strong" },
};

/** The colour of a card's headline. */
export const HEADLINE_TEXT: Record<HeadlineTone, string> = {
  order: "text-fault",
  close: "text-differ",
  clear: "text-match",
  watch: "text-ink",
  calm: "text-ink",
};
