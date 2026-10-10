/**
 * The cheap tests on a fetched item's text, made before and after the model
 * reads it: is it about haze, does it announce something, and is the quote the
 * model gave really in it.
 */

const HAZE = /\b(jerebu|haze|ipu|api|kualiti udara|air quality|pencemaran udara)\b/i;
const ACTION =
  /\b(sekolah|school|schools|tutup|ditutup|close|closed|closure|darurat|emergency|pdpr|kerja dari rumah|bekerja dari rumah|work from home|titah|arah|diarah|cuti|holiday|larang|larangan|ban|dibuka semula|reopen|reopens)\b/i;

export function aboutHaze(text: string): boolean {
  return HAZE.test(text);
}

/**
 * A headline that announces something rather than reports a reading. "38
 * kawasan catat IPU tidak sihat" is about haze and announces nothing, so it is
 * never handed to the model.
 */
export function announces(text: string): boolean {
  return aboutHaze(text) && ACTION.test(text);
}

/** Lower case, accents and punctuation gone, single spaces, so a PDF's line breaks and hyphens do not hide a match. */
export function flatten(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * The model's quote is in the text, word for word once case, spacing and
 * punctuation are set aside. A PDF's page numbers are dropped first: a page
 * break can fall mid-sentence and leave a "2" inside the quote's words.
 */
export function quoteFound(quote: string, text: string): boolean {
  const wanted = flatten(quote);
  if (wanted.length < 12) return false;
  // Tried both ways, since a number alone on a line can also be part of the text: "melebihi\n180\nberdasarkan".
  return flatten(text).includes(wanted) || flatten(text.replace(/\n\s*\d{1,3}\s*\n/g, "\n")).includes(wanted);
}
