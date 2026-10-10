/**
 * Where official statements about the haze are fetched from. Each channel
 * lists what it has and hands over an item's text; the jobs process decides
 * which to read.
 */

export type StatementChannel = "moe-statements" | "doe-statements" | "news-statements";

export interface StatementItem {
  url: string;
  channel: StatementChannel;
  /** Who published it: "Kementerian Pendidikan", "Astro Awani". */
  outlet: string;
  title: string;
  publishedAt: Date;
}

export interface StatementsClient {
  channel: StatementChannel;
  /** What the channel has now, newest first. */
  list(): Promise<StatementItem[]>;
  /** The item's text, as the model will read it and the quote is checked against. */
  text(item: StatementItem): Promise<string>;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name: string) => {
    if (name.startsWith("#x") || name.startsWith("#X")) return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (name.startsWith("#")) return String.fromCodePoint(Number(name.slice(1)));
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/** Markup to plain text: scripts and styles dropped, tags to line breaks, entities decoded. */
export function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, "\n"))
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
