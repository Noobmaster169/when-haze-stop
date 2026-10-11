import { TerminalError } from "../lib/errors";

/**
 * A small dense linear solve, for pulling the field to a few hundred points
 * at once. Gaussian elimination with partial pivoting is enough at that size
 * and has no dependency; the ridge keeps two points a cell apart, whose rows
 * are nearly the same, from throwing the answer about.
 */

/** A copy of `matrix` with `lambda` added down the diagonal. */
export function ridged(matrix: number[][], lambda: number): number[][] {
  return matrix.map((row, i) => row.map((value, j) => (i === j ? value + lambda : value)));
}

/** Solves `matrix * x = rhs` for a square `matrix`. Neither argument is written to. */
export function solve(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length;
  if (matrix.length !== n || matrix.some((row) => row.length !== n)) throw new TerminalError("the system to solve is not square");
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++) {
      if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
    }
    if (a[pivot][column] === 0) throw new TerminalError("the system to solve is singular");
    [a[column], a[pivot]] = [a[pivot], a[column]];
    for (let row = column + 1; row < n; row++) {
      const factor = a[row][column] / a[column][column];
      if (factor === 0) continue;
      for (let k = column; k <= n; k++) a[row][k] -= factor * a[column][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = a[row][n];
    for (let k = row + 1; k < n; k++) sum -= a[row][k] * x[k];
    x[row] = sum / a[row][row];
  }
  return x;
}
