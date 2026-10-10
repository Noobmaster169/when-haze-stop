import { extractText, getDocumentProxy } from "unpdf";

import { aboutHaze } from "../haze/statement-text";
import { TerminalError } from "../lib/errors";
import { fetchBytes, fetchText } from "./http";
import { decodeEntities, type StatementItem, type StatementsClient } from "./statements";

/**
 * The Education Ministry's press statements. The list page is a table of
 * title and date; each statement's page links the statement itself as a PDF
 * with a text layer.
 */

const LIST = "https://www.moe.gov.my/kenyataan-media";
const ORIGIN = "https://www.moe.gov.my";
const OUTLET = "Kementerian Pendidikan";
const TIMEOUT_MS = 30_000;
const MONTHS: Record<string, number> = { jan: 0, feb: 1, mac: 2, apr: 3, mei: 4, jun: 5, jul: 6, ogo: 7, ogos: 7, sep: 8, okt: 9, nov: 10, dis: 11 };

/** "08 Okt 2026" to midnight in Malaysia, or null. */
export function malayDate(text: string): Date | null {
  const match = text.trim().match(/^(\d{1,2}) ([a-z]+) (\d{4})$/i);
  const month = match ? MONTHS[match[2].toLowerCase()] : undefined;
  if (!match || month === undefined) return null;
  return new Date(Date.UTC(Number(match[3]), month, Number(match[1])) - 8 * 3_600_000);
}

/** The haze statements in the list page's table, newest first as the page orders them. */
export function parseMoeList(html: string): StatementItem[] {
  const rows = html.matchAll(/<a\s+href="([^"]+)">([^<]+)<\/a>\s*<\/td>\s*<td[^>]*>([^<]+)<\/td>/g);
  const items: StatementItem[] = [];
  for (const [, href, rawTitle, rawDate] of rows) {
    const title = decodeEntities(rawTitle).replace(/\s+/g, " ").trim();
    const publishedAt = malayDate(rawDate);
    if (!publishedAt || !aboutHaze(title)) continue;
    items.push({ url: new URL(href, ORIGIN).toString(), channel: "moe-statements", outlet: OUTLET, title, publishedAt });
  }
  return items;
}

/** The statement PDF a statement's page links to, or null when it links none. */
export function parseMoePdfLink(html: string): string | null {
  const match = html.match(/href="([^"]+\.pdf)"/i);
  return match ? new URL(decodeEntities(match[1]), ORIGIN).toString() : null;
}

export async function pdfText(bytes: Uint8Array): Promise<string> {
  const { text } = await extractText(await getDocumentProxy(bytes), { mergePages: true });
  return text;
}

export function moeStatementsClient(): StatementsClient {
  return {
    channel: "moe-statements",
    async list() {
      return parseMoeList(await fetchText(LIST, "Education Ministry press page", TIMEOUT_MS));
    },
    async text(item) {
      const pdf = parseMoePdfLink(await fetchText(item.url, "Education Ministry statement page", TIMEOUT_MS));
      if (!pdf) throw new TerminalError(`the statement page ${item.url} links no PDF`);
      return pdfText(await fetchBytes(pdf, "Education Ministry statement PDF", TIMEOUT_MS));
    },
  };
}
