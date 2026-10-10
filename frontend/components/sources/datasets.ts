import type { IconName } from "@/components/ui/icons";
import type { FetchDetail, SourceFetch } from "@/lib/api/source-schemas";
import { malaysiaClock, malaysiaDate } from "@/lib/malaysia-time";

/**
 * The four kinds of data the hourly job fetches, as a person would name them,
 * each with the numbers worth showing from its newest fetch. A dataset can be
 * more than one fetch (air quality is the station list and the readings); its
 * history pages through the one that carries the data.
 */

export interface Stat {
  icon: IconName;
  value: string;
  label: string;
}

export interface Dataset {
  /** Also the query parameter that pages its history. */
  key: "air" | "fires" | "weather" | "statements";
  title: string;
  icon: IconName;
  what: string;
  members: string[];
  history: string;
  stats(detailOf: (source: string) => FetchDetail | null): Stat[];
  /** The one number a row of its history shows. */
  summary(detail: FetchDetail): string;
}

function count(detail: FetchDetail | null, key: string): string {
  const value = detail?.[key];
  return typeof value === "number" ? value.toLocaleString("en-GB") : "n/a";
}

function text(detail: FetchDetail | null, key: string): string | null {
  const value = detail?.[key];
  return typeof value === "string" ? value : null;
}

/** One number added up over several fetches, or n/a when none of them recorded it. */
function total(details: (FetchDetail | null)[], key: string): string {
  const values = details.map((detail) => detail?.[key]).filter((value): value is number => typeof value === "number");
  return values.length === 0 ? "n/a" : values.reduce((sum, value) => sum + value, 0).toLocaleString("en-GB");
}

/** "2 to 15 Oct", or "28 Sep to 3 Oct" across a month. */
function span(from: string, to: string): string {
  const [fromDay, fromMonth] = malaysiaDate(from).split(" ");
  const end = malaysiaDate(to);
  return fromMonth === end.split(" ")[1] ? `${fromDay} to ${end}` : `${fromDay} ${fromMonth} to ${end}`;
}

export const DATASETS: readonly Dataset[] = [
  {
    key: "air",
    title: "Air quality readings",
    icon: "pin",
    what: "The official index from every DOE station.",
    members: ["doe-stations", "doe-readings"],
    history: "doe-readings",
    stats: (detailOf) => {
      const newest = text(detailOf("doe-readings"), "newestReading");
      return [
        { icon: "pin", value: count(detailOf("doe-stations"), "stations"), label: "stations" },
        { icon: "map", value: count(detailOf("doe-stations"), "states"), label: "states" },
        { icon: "chart", value: count(detailOf("doe-readings"), "received"), label: "readings received" },
        { icon: "clock", value: newest ? malaysiaClock(newest) : "n/a", label: newest ? `newest hour, ${malaysiaDate(newest)}` : "newest hour" },
      ];
    },
    summary: (detail) => `${count(detail, "added")} new of ${count(detail, "received")} received`,
  },
  {
    key: "fires",
    title: "Fire detections",
    icon: "flame",
    what: "Hotspots seen from space, where the smoke starts.",
    members: ["firms"],
    history: "firms",
    stats: (detailOf) => {
      const detail = detailOf("firms");
      return [
        { icon: "flame", value: count(detail, "detections"), label: "detections in the files" },
        { icon: "sun", value: count(detail, "glintDropped"), label: "dropped as sun glint" },
        { icon: "wave", value: count(detail, "offshoreDropped"), label: "dropped at sea" },
        { icon: "grid", value: count(detail, "cellDays"), label: "fire cells kept" },
      ];
    },
    summary: (detail) => `${count(detail, "cellDays")} fire cells`,
  },
  {
    key: "weather",
    title: "Wind and rain",
    icon: "wind",
    what: "The wind that carries the smoke, and the rain that clears it.",
    members: ["open-meteo"],
    history: "open-meteo",
    stats: (detailOf) => {
      const detail = detailOf("open-meteo");
      const from = text(detail, "from");
      const to = text(detail, "to");
      return [
        { icon: "grid", value: count(detail, "points"), label: "grid points" },
        { icon: "clock", value: count(detail, "hours"), label: "hours of wind" },
        { icon: "calendar", value: from && to ? span(from, to) : "n/a", label: "span covered" },
      ];
    },
    summary: (detail) => `${count(detail, "hours")} hours`,
  },
  {
    key: "statements",
    title: "Official statements",
    icon: "alert",
    what: "What ministries, states and Rulers decided about the haze, read by the model once each.",
    members: ["moe-statements", "doe-statements", "news-statements"],
    history: "news-statements",
    stats: (detailOf) => {
      const all = ["moe-statements", "doe-statements", "news-statements"].map(detailOf);
      return [
        { icon: "home", value: count(detailOf("moe-statements"), "listed"), label: "ministry statements on haze" },
        { icon: "external", value: count(detailOf("news-statements"), "listed"), label: "headlines that announce" },
        { icon: "check", value: total(all, "statements"), label: "statements read, newest fetch" },
      ];
    },
    summary: (detail) => `${count(detail, "new")} new, ${count(detail, "statements")} statements`,
  },
];

/** A fetch's one-line result: its number when it worked, its reason when it did not. */
export function resultOf(dataset: Dataset, fetch: SourceFetch): string {
  return fetch.ok ? dataset.summary(fetch.detail) : (fetch.error ?? "Failed");
}
