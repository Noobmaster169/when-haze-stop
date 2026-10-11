import { describe, expect, it } from "vitest";

import { scoreWords, share } from "./words";

describe("a plan's score in plain words", () => {
  it("rounds shares to whole percent, keeping a tenth below one", () => {
    expect(share(0.1449)).toBe("14%");
    expect(share(0.0017)).toBe("0.2%");
    expect(share(0)).toBe("0%");
  });

  it("says how much cleaner KL gets, what share that is, and the share if the wind turns", () => {
    expect(scoreWords({ meanRemoved: 1.62, expected: 0.146, worstWind: 0.118 })).toEqual({
      cleaner: "KL's air about 1.6 ug/m3 cleaner on average",
      clears: "Clears 15% of the smoke any plan could clear",
      ifWindTurns: "12% if the wind turns against it",
    });
  });
});
