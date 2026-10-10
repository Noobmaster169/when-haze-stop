/**
 * Which numbers in a seat's message appear in nothing it was shown.
 *
 * Seats must take every figure from the fact sheet, a tool or a score. This
 * does not judge arithmetic: a figure a seat worked out itself ("2 teams x 14
 * days = 28 ha") is listed too, and the page shows such numbers as not found
 * in the facts rather than as false. Small whole numbers (days, counts, plan
 * days) and years are too common to check.
 */

const NUMBER = /-?\d[\d,]*(?:\.\d+)?/g;

function forms(raw: string): string[] {
  const plain = raw.replace(/,/g, "");
  const value = Number(plain);
  if (!Number.isFinite(value)) return [plain];
  // "0.640" and "0.64", "12.0" and "12" are the same figure.
  return [plain, String(value), value.toFixed(1), value.toFixed(2)];
}

/** Every figure in the texts, in the forms it may be quoted in. */
export function figuresIn(texts: string[]): Set<string> {
  const seen = new Set<string>();
  for (const text of texts) for (const match of text.match(NUMBER) ?? []) for (const form of forms(match)) seen.add(form);
  return seen;
}

function checkable(raw: string): boolean {
  const value = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(value)) return false;
  if (Number.isInteger(value) && Math.abs(value) <= 31) return false;
  if (Number.isInteger(value) && value >= 1990 && value <= 2035) return false;
  return true;
}

export function unverified(message: string, seen: Set<string>): string[] {
  const missing = new Set<string>();
  for (const match of message.match(NUMBER) ?? []) {
    if (!checkable(match)) continue;
    const plain = match.replace(/,/g, "");
    if (!forms(plain).some((form) => seen.has(form))) missing.add(plain);
  }
  return [...missing];
}
