import { FakeLlmClient } from "../../src/agents/__fakes__/fake.llm-client";
import type { StatementReading } from "../../src/agents/statements/read-statement";

/**
 * The model's side of reading the recorded statements, scripted: what a
 * careful reader records from each item. The Johor reading quotes a sentence
 * the headline does not hold, to show that such a reading is kept and never
 * shown.
 */

const EMPTY: StatementReading = {
  isStatement: false,
  issuer: "other",
  issuerName: "",
  kind: "advice",
  action: "other",
  audience: "",
  states: [],
  districts: [],
  nationwide: false,
  threshold: null,
  sustainedDays: null,
  effectiveFrom: null,
  effectiveUntil: null,
  summary: "",
  quote: "",
};

const MOE = { isStatement: true, issuer: "moe", issuerName: "Ministry of Education", audience: "Schools", nationwide: true } as const;

const READINGS: [RegExp, StatementReading][] = [
  [
    /KETUA PENGARAH PENDIDIKAN/,
    {
      ...EMPTY,
      ...MOE,
      kind: "rule",
      action: "schools-close",
      threshold: 180,
      effectiveFrom: "2026-10-09",
      summary: "Education institutions close where the API passes 180, from 9 October.",
      quote: "Semua institusi pendidikan bawah KPM di kawasan yang mencatatkan bacaan IPU melebihi 180",
    },
  ],
  [
    /melebihi 200/,
    { ...EMPTY, ...MOE, kind: "rule", action: "schools-close", threshold: 200, summary: "Schools close at once where the API passes 200.", quote: "KPM arah sekolah ditutup serta-merta jika IPU melebihi 200" },
  ],
  [
    /Negeri Sembilan ditutup/,
    {
      ...EMPTY,
      ...MOE,
      nationwide: false,
      kind: "order",
      action: "schools-close",
      states: ["Negeri Sembilan"],
      effectiveFrom: "2026-10-09",
      summary: "All education institutions in Negeri Sembilan close from 9 October.",
      quote: "Semua institusi pendidikan di Negeri Sembilan ditutup esok",
    },
  ],
  [
    /Johor ditutup/,
    {
      ...EMPTY,
      isStatement: true,
      issuer: "ruler",
      issuerName: "Johor Regent",
      kind: "order",
      action: "schools-close",
      audience: "Schools",
      states: ["Johor"],
      effectiveFrom: "2026-10-08",
      effectiveUntil: "2026-10-09",
      summary: "All schools in Johor close on 8 and 9 October.",
      quote: "Semua sekolah di Johor ditutup pada 8 dan 9 Oktober",
    },
  ],
];

export function statementReader(): FakeLlmClient {
  return new FakeLlmClient((request) => {
    const found = READINGS.find(([pattern]) => pattern.test(request.user));
    return JSON.stringify(found ? found[1] : EMPTY);
  });
}
