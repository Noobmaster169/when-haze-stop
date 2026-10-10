import { describe, expect, it } from "vitest";

import { ridged, solve } from "../../src/haze/solve";

describe("the dense solve", () => {
  it("solves a three by three system whose answer is known", () => {
    // 2x + y - z = 8, -3x - y + 2z = -11, -2x + y + 2z = -3, which (2, 3, -1) satisfies.
    const matrix = [
      [2, 1, -1],
      [-3, -1, 2],
      [-2, 1, 2],
    ];
    const rhs = [8, -11, -3];
    const x = solve(matrix, rhs);
    expect(x[0]).toBeCloseTo(2, 10);
    expect(x[1]).toBeCloseTo(3, 10);
    expect(x[2]).toBeCloseTo(-1, 10);
    // Neither argument is written to.
    expect(matrix).toEqual([
      [2, 1, -1],
      [-3, -1, 2],
      [-2, 1, 2],
    ]);
    expect(rhs).toEqual([8, -11, -3]);
  });

  it("pivots past a zero on the diagonal", () => {
    const x = solve(
      [
        [0, 1],
        [1, 0],
      ],
      [3, 5],
    );
    expect(x).toEqual([5, 3]);
  });

  it("refuses a singular system, and answers it once ridged", () => {
    const singular = [
      [1, 1],
      [1, 1],
    ];
    expect(() => solve(singular, [1, 1])).toThrow("singular");
    const x = solve(ridged(singular, 0.02), [1, 1]);
    expect(x[0]).toBeCloseTo(1 / 2.02, 10);
    expect(x[1]).toBeCloseTo(1 / 2.02, 10);
    expect(singular).toEqual([
      [1, 1],
      [1, 1],
    ]);
  });

  it("refuses a system that is not square", () => {
    expect(() => solve([[1, 2]], [1])).toThrow("square");
  });
});
