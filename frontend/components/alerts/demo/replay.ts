import type { AlertKind } from "@/lib/api/alert-schemas";

/**
 * The demo is a replay of the evening of 8 October 2026 in Seremban, not an
 * invented alert. Every value below was recorded:
 *
 * - The rule: the Education Ministry's statement of 8 October, first reported
 *   by RTM at 19:09 Malaysian time (`statements` table).
 * - The forecast: the model run on the readings of 20:00 (run 48, method v2,
 *   as of 2026-10-08T12:00Z) gave Seremban a peak of 192 on the 9th, likely
 *   166 to 205, and a 76% chance of passing 180. The live job runs at 20 past,
 *   so that alert would have gone out at about 20:20.
 * - The order: Negeri Sembilan's closure, first reported by Kosmo Online at
 *   20:14 (`statements` table). The job reads the news at 20 past, so the
 *   alert for it would have gone out at the next cycle, about 21:20.
 * - The outcome: DOE's readings for Seremban peaked at 189 on 9 October.
 *
 * Seremban is the area to replay because it is the one where the forecast
 * passed the 60% bar that evening. Nothing here is written to the database.
 */

export interface ReplayAlert {
  kind: AlertKind;
  /** The notification's title. */
  title: string;
  /** What the person is told, exactly as the live alert words it. */
  message: string;
}

/** One moment of the evening: when, what the presenter's bar says, and the alert sent then, if one was. */
export interface ReplayStep {
  at: string;
  caption: string;
  alert: ReplayAlert | null;
}

export const REPLAY_PLACE = "Seremban, Negeri Sembilan";
export const REPLAY_STATION = "Seremban";

export const REPLAY_STEPS: readonly ReplayStep[] = [
  {
    at: "8 Oct, 19:09",
    caption: "The Education Ministry rules that schools close wherever the API passes 180, from 9 October. This replay follows Seremban, as a parent there would.",
    alert: null,
  },
  {
    at: "8 Oct, 20:20",
    caption: "The forecast from the 20:00 readings puts Seremban's peak tomorrow at 192, likely 166 to 205: a 76% chance of passing 180. The hourly check sends this alert.",
    alert: {
      kind: "arriving",
      title: "Haze forecast",
      message: "Seremban: schools may close tomorrow. 76% chance of API above 180, the Education Ministry's closing line.",
    },
  },
  {
    at: "8 Oct, 21:20",
    caption: "Negeri Sembilan's closure was first reported by Kosmo Online at 20:14. The next hourly check reads it and sends the official order.",
    alert: {
      kind: "order",
      title: "Official order",
      message: "Ministry of Education: All schools in Negeri Sembilan close on 9 October.",
    },
  },
  {
    at: "9 Oct",
    caption: "Seremban peaked at 189, above the closing line, and its schools were shut that day. The warning came the evening before, with the official word beside it.",
    alert: null,
  },
];

/** Step 0 is no replay; the steps run 1 to the last. */
export const LAST_STEP = REPLAY_STEPS.length;

export function clampStep(step: number): number {
  return Math.min(LAST_STEP, Math.max(1, step));
}

/** The alerts sent up to a step, newest first, each with when it was sent: what the toasts show. */
export function replayAlertsAt(step: number): { at: string; alert: ReplayAlert }[] {
  return REPLAY_STEPS.slice(0, Math.max(0, step))
    .flatMap((moment) => (moment.alert ? [{ at: moment.at, alert: moment.alert }] : []))
    .reverse();
}
