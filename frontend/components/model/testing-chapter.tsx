import { MONTHS } from "./backtest-figures";
import { ModelChapter } from "./model-chapter";
import { Formula, P, Strong } from "./prose";

/** Chapter 3: the loss the trees minimise, the walk-forward test, its leak checks, and what an error of 15 µg/m³ means. */

const LOSS = `Lq = Σ rows  w · ( q·(y − ŷ)  if y ≥ ŷ,  else  (q − 1)·(y − ŷ) )
w = kind weight (reference monitor 1.0, corrected sensor 0.6, airport 0.4) × 3 if y > 55 µg/m³`;

export function TestingChapter() {
  return (
    <ModelChapter id="testing">
      <P>
        <Strong>Training loss.</Strong> Each quantile model minimises the pinball loss, weighted so hazy days count more:
      </P>
      <Formula>{LOSS}</Formula>
      <P>
        <Strong>Test design.</Strong> Walk-forward by month: train on every month before, test on the next, over {MONTHS.length} test months from July 2025 to October 2026, with a two day gap so no test
        label leaks into training. The model is compared on exactly the same rows with three baselines: assume no change, the app&apos;s current forecast (v2), and the instrument&apos;s monthly
        climatology. Two leak tests check the harness: a model fed tomorrow&apos;s features must beat no change (it does, 2.2 against 5.9), and a model fed shuffled targets must not beat climatology (it
        does not, 10.7 against 7.5).
      </P>
      <P>
        <Strong>What the error number means.</Strong> MAE is the mean absolute difference between the forecast peak and the real peak, in µg/m³. It is not a percentage. On the reference monitors a hazy
        day&apos;s peak averages 67 µg/m³ (median 58, nine in ten below 109), so 15.5 µg/m³ is roughly a 23% miss on a typical hazy day; no change misses by 26%, the current forecast by 27%. Because the
        API table is steep between 50 and 55 µg/m³, a 15 µg/m³ miss can be 30 or more index points near the 100 to 150 lines, and only a few points above 150.
      </P>
    </ModelChapter>
  );
}
