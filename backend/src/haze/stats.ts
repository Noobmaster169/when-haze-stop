/** The few statistics the model needs, kept here so nothing else does arithmetic on arrays inline. */

function ranks(values: number[]): number[] {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const rank = new Array<number>(values.length);
  for (let start = 0; start < order.length; ) {
    let end = start;
    while (end + 1 < order.length && order[end + 1].value === order[start].value) end++;
    // Ties share the mean of the ranks they span.
    const shared = (start + end) / 2 + 1;
    for (let k = start; k <= end; k++) rank[order[k].index] = shared;
    start = end + 1;
  }
  return rank;
}

export function pearson(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 3) return null;
  const meanX = x.reduce((sum, value) => sum + value, 0) / n;
  const meanY = y.reduce((sum, value) => sum + value, 0) / n;
  let cross = 0;
  let spreadX = 0;
  let spreadY = 0;
  for (let i = 0; i < n; i++) {
    cross += (x[i] - meanX) * (y[i] - meanY);
    spreadX += (x[i] - meanX) ** 2;
    spreadY += (y[i] - meanY) ** 2;
  }
  return spreadX === 0 || spreadY === 0 ? null : cross / Math.sqrt(spreadX * spreadY);
}

/** Rank correlation: whether more modelled smoke goes with a higher reading, whatever the units. */
export function spearman(x: number[], y: number[]): number | null {
  return pearson(ranks(x), ranks(y));
}

/** Least squares for `y = intercept + slope * x`. Null where x does not vary. */
export function fitLine(x: number[], y: number[]): { intercept: number; slope: number } | null {
  const n = x.length;
  if (n < 2) return null;
  const meanX = x.reduce((sum, value) => sum + value, 0) / n;
  const meanY = y.reduce((sum, value) => sum + value, 0) / n;
  let cross = 0;
  let spread = 0;
  for (let i = 0; i < n; i++) {
    cross += (x[i] - meanX) * (y[i] - meanY);
    spread += (x[i] - meanX) ** 2;
  }
  if (spread === 0) return null;
  const slope = cross / spread;
  return { intercept: meanY - slope * meanX, slope };
}

/** The mean of the `window` values ending at each index, shorter at the start where there are fewer. */
export function trailingMean(series: Float32Array, window: number): Float32Array {
  const out = new Float32Array(series.length);
  let sum = 0;
  for (let i = 0; i < series.length; i++) {
    sum += series[i];
    if (i >= window) sum -= series[i - window];
    out[i] = sum / Math.min(window, i + 1);
  }
  return out;
}
