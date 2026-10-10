import type { AlertKind } from "@/lib/api/alert-schemas";

/** How each kind of alert is dressed and named: a reading over a line is the loud one, clearing the calm one. */
export const TONE: Record<AlertKind, { label: string; box: string; text: string }> = {
  observed: { label: "Now", box: "border-fault-line bg-fault-tint", text: "text-fault" },
  arriving: { label: "Forecast", box: "border-differ-line bg-differ-tint", text: "text-differ" },
  clearing: { label: "Clearing", box: "border-match-line bg-match-tint", text: "text-match" },
};
