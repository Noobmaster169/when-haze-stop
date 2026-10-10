import { describe, expect, it } from "vitest";

import { MODEL_CHAPTERS } from "./chapters";
import { GLOSSARY } from "./glossary";

describe("the Model page's opening", () => {
  it("opens on the live record, then what is being forecast, before the verdict", () => {
    expect(MODEL_CHAPTERS.map((chapter) => chapter.id).slice(0, 3)).toEqual(["live", "data", "verdict"]);
  });

  it("defines the thirteen words the charts use, each once", () => {
    expect(GLOSSARY).toHaveLength(13);
    expect(new Set(GLOSSARY.map((entry) => entry.term)).size).toBe(13);
  });
});
