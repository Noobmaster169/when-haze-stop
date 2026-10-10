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
  /** When the app would have sent it, Malaysian time. */
  at: string;
  /** The notification's title. */
  title: string;
  /** What the person is told, exactly as the live alert words it. */
  message: string;
  source: { label: string; url: string };
}

export const REPLAY_PLACE = "Seremban, Negeri Sembilan";
export const REPLAY_DATE = "8 Oct";

export const RULE = {
  at: "8 Oct, 19:09",
  text: "The Education Ministry rules that schools close wherever the API passes 180, from 9 October.",
  source: { label: "Kementerian Pendidikan", url: "https://www.moe.gov.my/kenyataan-media-berhubung-kpm-junjung-titah-kdymm-" },
};

export const REPLAY: readonly ReplayAlert[] = [
  {
    kind: "arriving",
    at: "8 Oct, 20:20",
    title: "Haze forecast",
    message: "Seremban: schools may close tomorrow. 76% chance of API above 180, the Education Ministry's closing line.",
    source: { label: "Forecast from the 20:00 readings: peak 192, likely 166 to 205", url: "/map?station=CA24N" },
  },
  {
    kind: "order",
    at: "8 Oct, 21:20",
    title: "Official order",
    message: "Ministry of Education: All schools in Negeri Sembilan close on 9 October.",
    source: {
      label: "First reported by Kosmo Online at 20:14",
      url: "https://news.google.com/rss/articles/CBMiiAFBVV95cUxQTjh6MDdZWkxpX1hQNnZjVDBTWXBGWjZsX0VGWDdJdXo0NmhLdmNhcWpxYjUyUjdNNjV6UERhN01SYWNPcnpwN1hySVBvMnNoQURVQ3hrRTVJSk5yekN3U3pZTEpxaWk5Sm03V0ZSZkpINzJ2WG1jdEctVWd2elpSalhwX1puR25j?oc=5",
    },
  },
];

export const OUTCOME = {
  at: "9 Oct",
  text: "Seremban peaked at 189, above the closing line, and its schools were shut that day. The warning came the evening before, with the official word beside it.",
};
