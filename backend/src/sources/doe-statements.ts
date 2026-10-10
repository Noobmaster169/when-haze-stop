import { z } from "zod";

import { UpstreamError } from "../lib/errors";
import { fetchText } from "./http";
import { decodeEntities, htmlToText, type StatementItem, type StatementsClient } from "./statements";

/**
 * DOE's own posts, from its WordPress API, searched for "jerebu". The post's
 * content comes with the list, so reading one asks for nothing more.
 */

const API = "https://www.doe.gov.my/wp-json/wp/v2/posts";
const OUTLET = "Jabatan Alam Sekitar";
const TIMEOUT_MS = 30_000;
const WINDOW_DAYS = 30;

const Post = z.object({
  date_gmt: z.string(),
  link: z.string(),
  title: z.object({ rendered: z.string() }),
  content: z.object({ rendered: z.string() }),
});

export interface DoePost extends StatementItem {
  text: string;
}

export function parseDoePosts(json: string): DoePost[] {
  const parsed = z.array(Post).safeParse(JSON.parse(json));
  if (!parsed.success) throw new UpstreamError(200, "DOE posts came back in a shape this client does not know", { cause: parsed.error });
  return parsed.data.map((post) => ({
    url: post.link,
    channel: "doe-statements",
    outlet: OUTLET,
    title: decodeEntities(post.title.rendered).trim(),
    publishedAt: new Date(`${post.date_gmt}Z`),
    text: htmlToText(post.content.rendered),
  }));
}

export function doeStatementsClient(now: () => Date = () => new Date()): StatementsClient {
  const texts = new Map<string, string>();
  return {
    channel: "doe-statements",
    async list() {
      const after = new Date(now().getTime() - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 19);
      const url = `${API}?search=jerebu&after=${after}&per_page=20&_fields=date_gmt,link,title,content`;
      const posts = parseDoePosts(await fetchText(url, "DOE posts", TIMEOUT_MS));
      for (const post of posts) texts.set(post.url, post.text);
      return posts.map(({ text: _text, ...item }) => item);
    },
    async text(item) {
      return texts.get(item.url) ?? item.title;
    },
  };
}
