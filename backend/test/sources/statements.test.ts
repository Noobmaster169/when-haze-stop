import { describe, expect, it } from "vitest";

import { parseDoePosts } from "../../src/sources/doe-statements";
import { malayDate, parseMoeList, parseMoePdfLink } from "../../src/sources/moe-statements";
import { parseNewsRss } from "../../src/sources/news-statements";
import { DOE_POSTS_JSON, MOE_LIST_HTML, MOE_STATEMENT_PAGE, NEWS_RSS } from "../fixtures/recorded-statements";

describe("the Education Ministry press page", () => {
  it("keeps only the haze statements, each dated midnight in Malaysia", () => {
    const items = parseMoeList(MOE_LIST_HTML);
    // The budget statement is left out; the closure rule and the order to state education departments stay.
    expect(items).toHaveLength(2);
    expect(items.every((item) => /Jerebu/.test(item.title))).toBe(true);
    expect(items[0]).toMatchObject({ channel: "moe-statements", outlet: "Kementerian Pendidikan", url: "https://www.moe.gov.my/kenyataan-media-berhubung-kpm-junjung-titah-kdymm-" });
    expect(items[0].title).toMatch(/Susulan Keadaan Jerebu$/);
    expect(items[0].publishedAt.toISOString()).toBe("2026-10-07T16:00:00.000Z");
  });

  it("reads Malay month names and refuses what is not a date", () => {
    expect(malayDate("10 Ogo 2026")?.toISOString()).toBe("2026-08-09T16:00:00.000Z");
    expect(malayDate("Okt 2026")).toBeNull();
  });

  it("finds the statement PDF on its page", () => {
    expect(parseMoePdfLink(MOE_STATEMENT_PAGE)).toMatch(/^https:\/\/www\.moe\.gov\.my\/storage\/files\/shares\/Kenyataan%20Media\/KM2026\/.+JEREBU\.pdf$/);
    expect(parseMoePdfLink("<p>no link</p>")).toBeNull();
  });
});

describe("DOE posts", () => {
  it("gives each post its title, time and text", () => {
    const posts = parseDoePosts(DOE_POSTS_JSON);
    expect(posts).toHaveLength(3);
    expect(posts[0]).toMatchObject({ title: "Kronologi Episod Jerebu di Malaysia", outlet: "Jabatan Alam Sekitar", channel: "doe-statements" });
    expect(posts[0].publishedAt.toISOString()).toBe("2021-10-04T07:43:15.000Z");
    // The recorded content is cut at 1,500 characters, mid-tag; every whole tag is gone.
    expect(posts[0].text).not.toMatch(/<[^>]*>/);
  });

  it("fails naming the shape when DOE answers something else", () => {
    expect(() => parseDoePosts('{"code":"rest_no_route"}')).toThrow(/shape this client does not know/);
  });
});

describe("the news search", () => {
  it("keeps headlines that announce something, without the outlet Google appends", () => {
    const items = parseNewsRss(NEWS_RSS);
    expect(items.map((item) => item.title)).toEqual([
      "Jerebu: KPM arah sekolah ditutup serta-merta jika IPU melebihi 200",
      "Jerebu: Semua sekolah di Johor ditutup dua hari bermula esok",
      "Jerebu: Sekolah di kawasan IPU melebihi 180 diarah tutup bermula Jumaat - KPM",
      "[TERKINI] Jerebu: Semua institusi pendidikan di Negeri Sembilan ditutup esok",
      "Jerebu: Sekolah di empat negeri, KL, Putrajaya dan daerah Rompin ditutup esok - Fadhlina",
    ]);
    expect(items[0]).toMatchObject({ outlet: "Astro Awani", channel: "news-statements" });
    expect(items[0].url).toMatch(/^https:\/\/news\.google\.com\/rss\/articles\//);
  });

  it("drops an outlet's own signature too", () => {
    // A Sinar Harian headline of 8 October 2026 as the feed carried it.
    const xml = `<item><title>Jerebu: Semua sekolah di Negeri Sembilan ditutup esok | Sinar Harian - Sinar Harian</title><link>https://news.google.com/rss/articles/a</link><pubDate>Thu, 08 Oct 2026 06:10:00 GMT</pubDate><source url="https://www.sinarharian.com.my">Sinar Harian</source></item>`;
    expect(parseNewsRss(xml)[0].title).toBe("Jerebu: Semua sekolah di Negeri Sembilan ditutup esok");
  });
});
