import { announces } from "../haze/statement-text";
import { fetchText } from "./http";
import { decodeEntities, type StatementItem, type StatementsClient } from "./statements";

/**
 * Orders the ministries do not post where we can fetch them (a state closing
 * its schools, a Ruler's decree, an emergency) reach the press first. Google
 * News search finds them; the item is its headline alone, because article
 * links go through Google redirects.
 */

const SEARCHES = [
  "https://news.google.com/rss/search?q=jerebu+when:7d&hl=ms-MY&gl=MY&ceid=MY:ms",
  "https://news.google.com/rss/search?q=haze+Malaysia+when:7d&hl=en-MY&gl=MY&ceid=MY:en",
];
const TIMEOUT_MS = 30_000;

function tag(item: string, name: string): string | null {
  const match = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return match ? decodeEntities(match[1]).trim() : null;
}

/** The items whose headline announces something, without the " - Outlet" Google appends. */
export function parseNewsRss(xml: string): StatementItem[] {
  const items: StatementItem[] = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = tag(item, "title");
    const link = tag(item, "link");
    const published = tag(item, "pubDate");
    const outlet = tag(item, "source") ?? "News";
    if (!title || !link || !published) continue;
    // Some outlets also sign their own titles: "... | Sinar Harian - Sinar Harian".
    const headline = title.replace(new RegExp(`(\\s[-|]\\s${outlet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})+$`), "").trim();
    if (!announces(headline)) continue;
    items.push({ url: link, channel: "news-statements", outlet, title: headline, publishedAt: new Date(published) });
  }
  return items;
}

export function newsStatementsClient(): StatementsClient {
  return {
    channel: "news-statements",
    async list() {
      const seen = new Map<string, StatementItem>();
      for (const url of SEARCHES) {
        for (const item of parseNewsRss(await fetchText(url, "Google News search", TIMEOUT_MS))) seen.set(item.url, item);
      }
      return [...seen.values()].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    },
    async text(item) {
      return item.title;
    },
  };
}
