import { describe, expect, it } from "vitest";

import { quoteFound, announces } from "../../src/haze/statement-text";
import { covers, ordersFor, resolveStatements, type StoredStatement } from "../../src/haze/statements";
import { MOE_PAGE_BREAK_TEXT, MOE_PDF_TEXT } from "../fixtures/recorded-statements";

/**
 * The statements below are the headlines in recorded-statements.ts as the
 * reader would record them: issuer, areas and dates are what each headline
 * says, dated by when it was published.
 */
function statement(id: number, fields: Partial<StoredStatement> & Pick<StoredStatement, "publishedAt">): StoredStatement {
  return {
    id,
    url: `https://example.test/${id}`,
    channel: "news-statements",
    outlet: "Astro Awani",
    issuer: "moe",
    issuerName: "Ministry of Education",
    kind: "order",
    action: "schools-close",
    audience: "Schools",
    states: [],
    districts: [],
    nationwide: false,
    threshold: null,
    sustainedDays: null,
    effectiveFrom: null,
    effectiveUntil: null,
    summary: "",
    quote: "",
    ...fields,
  };
}

const RULE_200 = statement(1, { kind: "rule", nationwide: true, threshold: 200, publishedAt: new Date("2026-10-07T01:39:00Z") });
const JOHOR = statement(2, { issuer: "ruler", issuerName: "Johor Regent", states: ["Johor"], effectiveFrom: "2026-10-08", effectiveUntil: "2026-10-09", publishedAt: new Date("2026-10-07T04:15:00Z") });
const RULE_180 = statement(3, { kind: "rule", nationwide: true, threshold: 180, effectiveFrom: "2026-10-09", publishedAt: new Date("2026-10-08T04:06:00Z") });
const RULE_180_PDF = statement(4, { ...RULE_180, channel: "moe-statements", outlet: "Kementerian Pendidikan", url: "https://www.moe.gov.my/x", publishedAt: new Date("2026-10-08T09:00:00Z") });
const RULE_150 = statement(5, { kind: "rule", nationwide: true, threshold: 150, sustainedDays: 3, effectiveFrom: "2026-10-12", publishedAt: new Date("2026-10-08T04:06:00Z") });
const NEGERI_SEMBILAN = statement(6, { states: ["Negeri Sembilan"], effectiveFrom: "2026-10-09", publishedAt: new Date("2026-10-08T06:02:00Z") });
const ROMPIN = statement(7, { states: ["Selangor", "Melaka", "WP Kuala Lumpur", "WP Putrajaya"], districts: ["Rompin"], effectiveFrom: "2026-10-09", publishedAt: new Date("2026-10-08T13:00:00Z") });

describe("which statements are one, and which are still in force", () => {
  const resolved = resolveStatements([RULE_200, JOHOR, RULE_180, RULE_180_PDF, RULE_150, NEGERI_SEMBILAN, ROMPIN], "2026-10-10");
  const byId = (id: number) => resolved.find((item) => item.id === id);

  it("counts two reports of one rule once, linking the ministry's own copy", () => {
    expect(resolved.filter((item) => item.threshold === 180)).toHaveLength(1);
    expect(byId(3)).toMatchObject({ reports: 2, url: "https://www.moe.gov.my/x", outlet: "Kementerian Pendidikan" });
  });

  it("replaces the 200 rule with the 180 rule, and keeps the three-day rule beside it", () => {
    expect(byId(1)?.status).toBe("replaced");
    expect(byId(3)?.status).toBe("in-force");
    expect(byId(5)?.status).toBe("upcoming");
  });

  it("ends Johor's two-day closure after its last day", () => {
    expect(byId(2)?.status).toBe("ended");
    expect(resolveStatements([JOHOR], "2026-10-09")[0].status).toBe("in-force");
    expect(resolveStatements([JOHOR], "2026-10-07")[0].status).toBe("upcoming");
  });

  it("ends a closure when a later statement reopens schools, on the day they reopen", () => {
    const reopen = statement(8, { kind: "lift", action: "reopen", states: ["Negeri Sembilan"], effectiveFrom: "2026-10-13", publishedAt: new Date("2026-10-11T04:00:00Z") });
    expect(resolveStatements([NEGERI_SEMBILAN, reopen], "2026-10-12").find((item) => item.id === 6)?.status).toBe("in-force");
    expect(resolveStatements([NEGERI_SEMBILAN, reopen], "2026-10-13").find((item) => item.id === 6)?.status).toBe("ended");
  });

  it("makes the headlines of one day's closures one decision covering every area they name", () => {
    const closure = byId(6);
    expect(byId(7)).toBeUndefined();
    expect(closure).toMatchObject({ reports: 2, districts: ["Rompin"], status: "in-force" });
    expect(closure?.states.sort()).toEqual(["Melaka", "Negeri Sembilan", "Selangor", "WP Kuala Lumpur", "WP Putrajaya"]);
    expect(resolved[0].id).toBe(6);
  });

  it("stops calling a closure with no stated end in force after a week without word", () => {
    expect(resolveStatements([NEGERI_SEMBILAN], "2026-10-16")[0].status).toBe("in-force");
    expect(resolveStatements([NEGERI_SEMBILAN], "2026-10-17")[0].status).toBe("ended");
  });
});

describe("which areas an order covers", () => {
  const none = () => null;
  const seremban = { name: "Seremban", state: "Negeri Sembilan", lat: 2.7, lon: 101.94 };
  const rompin = { name: "Rompin", state: "Pahang", lat: 2.81, lon: 103.48 };
  const temerloh = { name: "Temerloh", state: "Pahang", lat: 3.47, lon: 102.38 };

  it("covers a station by its state, or by a district named after it or near it", () => {
    expect(covers(NEGERI_SEMBILAN, seremban, none)).toBe(true);
    expect(covers(ROMPIN, rompin, none)).toBe(true);
    expect(covers(ROMPIN, temerloh, none)).toBe(false);
    expect(covers({ ...ROMPIN, districts: ["Kuala Rompin"] }, rompin, () => ({ lat: 2.8, lon: 103.49 }))).toBe(true);
  });

  it("gives a station only the closures in force or coming, not rules", () => {
    const resolved = resolveStatements([RULE_180, NEGERI_SEMBILAN, JOHOR], "2026-10-10");
    expect(ordersFor(resolved, seremban, none).map((item) => item.id)).toEqual([6]);
    expect(ordersFor(resolved, { name: "Segamat", state: "Johor", lat: 2.5, lon: 102.8 }, none)).toEqual([]);
  });
});

describe("the checks on an item's text", () => {
  it("finds a quote across the PDF's line breaks, and not one the text does not hold", () => {
    expect(quoteFound("Semua institusi pendidikan bawah KPM di kawasan yang mencatatkan bacaan IPU melebihi 180", MOE_PDF_TEXT)).toBe(true);
    expect(quoteFound("Semua institusi pendidikan bawah KPM di kawasan yang mencatatkan bacaan IPU melebihi 200", MOE_PDF_TEXT)).toBe(false);
    expect(quoteFound("IPU", MOE_PDF_TEXT)).toBe(false);
  });

  it("finds a quote that runs across a page break and its page number", () => {
    const quote = "institusi pendidikan di bawah seliaan JPN Johor di daerah Batu Pahat ditutup sementara mulai 7 Oktober 2026 (Rabu) sehingga keadaan kembali selamat";
    expect(quoteFound(quote, MOE_PAGE_BREAK_TEXT)).toBe(true);
  });

  it("tells an announcement from a round-up of readings", () => {
    expect(announces("Jerebu: Semua sekolah di Johor ditutup dua hari bermula esok")).toBe(true);
    expect(announces("Jerebu: 38 kawasan catat IPU tidak sihat, Seremban tertinggi")).toBe(false);
    expect(announces("Jerebu tebal, langit merah selubungi Kalimantan")).toBe(false);
  });
});

describe("a district's state", () => {
  it("is not covered as a whole when only the district is named", async () => {
    const { tidyAreas } = await import("../../src/services/statements");
    expect(tidyAreas({ states: ["Johor"], districts: ["Batu Pahat"] })).toEqual({ states: [], districts: ["Batu Pahat"] });
    expect(tidyAreas({ states: ["WP Kuala Lumpur", "WP Putrajaya"], districts: ["Rompin"] }).states).toEqual(["WP Kuala Lumpur", "WP Putrajaya"]);
  });
});
