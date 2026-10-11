/**
 * A seeded random source, so a run of the model can be repeated exactly.
 * mulberry32: small, fast, and good enough for scattering particles.
 */

export interface Random {
  /** Uniform on [0, 1). */
  next(): number;
  /** Standard normal. */
  gauss(): number;
}

export function seeded(seed: number): Random {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = (): number => {
    let u = 0;
    // log(0) is the one value Box-Muller cannot take.
    while (u === 0) u = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  return { next, gauss };
}
