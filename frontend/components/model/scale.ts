/**
 * The arithmetic under the Model page's charts: an axis rounded out to a
 * round step so every tick names a real value, and a linear map from data to
 * pixels. Pure, so the scale is tested without drawing.
 */

export interface Axis {
  low: number;
  high: number;
  ticks: number[];
}

/** The smallest run of whole steps that holds every value; a flat series still gets one step of height. */
export function niceAxis(values: readonly number[], step: number): Axis {
  if (values.length === 0 || step <= 0) return { low: 0, high: step, ticks: [0, step] };
  let low = Math.floor(Math.min(...values) / step) * step;
  let high = Math.ceil(Math.max(...values) / step) * step;
  if (high === low) high = low + step;
  // Floating steps drift; rounding to the step's own precision keeps tick labels exact.
  const fix = (value: number): number => Number(value.toFixed(10));
  low = fix(low);
  high = fix(high);
  const count = Math.round((high - low) / step);
  return { low, high, ticks: Array.from({ length: count + 1 }, (_, index) => fix(low + index * step)) };
}

/** A map from [low, high] onto [from, to]; `to` may be smaller than `from` for a y axis that grows upward. */
export function linear(low: number, high: number, from: number, to: number): (value: number) => number {
  const span = high - low || 1;
  return (value: number): number => from + ((value - low) / span) * (to - from);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A short day label, "14 Sep", spelled here rather than by the runtime's locale data, which differs between server and browser ("Sept") and would break hydration. */
export function dayLabel(day: string): string {
  const [, month, date] = day.split("-").map(Number);
  return `${date} ${MONTHS[month - 1]}`;
}
