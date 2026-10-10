import type { ModelPerformance } from "@/lib/model-performance-schema";

import { DAY_TWO } from "./backtest-figures";
import { ModelChapter } from "./model-chapter";
import { Bullets, P, Strong } from "./prose";
import { percent } from "./table";

/** Chapters 6 and 7: where the model falls short, then what it changes for a person and the gate it must pass first. */

export function WeaknessesChapter({ data }: { data: ModelPerformance }) {
  const moves = data.nextDay.bigMoves;
  const share = Math.round((10 * moves.sizePredicted.model) / moves.realSize) * 10;
  return (
    <ModelChapter id="weaknesses">
      <Bullets>
        <li>
          <Strong>It under-calls sharp changes.</Strong> On big day-to-day moves it predicts about {share}% of the size. The likely cause is that the training rows are dominated by quiet days and by
          today&apos;s reading, so the trees learn to stay near it. The fix is to train a second model on the change itself and to weight episode days harder; both are cheap to try with the harness as
          built.
        </li>
        <li>
          <Strong>The map&apos;s forecast frames are not the model.</Strong> Playing the timeline past &quot;Now&quot; still shows the old method, which pushes each station&apos;s trend outward and paints
          lone red patches around stations. The model feeds only the station panel&apos;s &quot;Next days&quot;, the alerts and the assistant. Wiring the map to the model&apos;s peaks is a pending change.
        </li>
        <li>
          <Strong>The band is too narrow.</Strong> 23% of truths fall below the 10th percentile and 24% above the 90th, where 10% each is the design. Any &quot;chance of crossing&quot; read from the band is
          overconfident until the quantile models are recalibrated.
        </li>
        <li>
          <Strong>It never forecast a crossing of 200.</Strong> Every day that really reached API 200 was missed at that line. It is cautious at the extreme.
        </li>
        <li>
          <Strong>It gives little warning before an episode starts.</Strong> Over 19 episode onsets at reference monitors the average lead was 0.4 days; no change and the current forecast gave 0. It mostly
          tracks a rise once it has begun.
        </li>
        <li>
          <Strong>The hazy-day evidence is mostly Singapore.</Strong> 168 hazy days from five regions, August to October 2026. DOE stations contribute one week. Shadow mode on the live DOE stations is how
          this gets firmed up.
        </li>
        <li>
          <Strong>The 15% target was missed.</Strong> The target was 15% below the best baseline on hazy days at day +1; it reached 12%. The two-day target (any gain) was met by a wide margin.
        </li>
      </Bullets>
    </ModelChapter>
  );
}

export function PersonChapter({ data }: { data: ModelPerformance }) {
  const two = data.backtest.hazyMaeDay2;
  const cut = Math.round((100 * (two.v2 - two.model)) / two.v2);
  const alarm = (key: "model" | "noChange"): string => percent(DAY_TWO.rows.find((row) => row.key === key)?.falseAlarm150 ?? 0);
  return (
    <ModelChapter id="person">
      <P>
        The app&apos;s outlook shows, for each station, a peak for tomorrow and the day after and the chance of passing 150 (school closure line) and 200. Today those peaks come from a trend extrapolation
        that is as good as &quot;no change&quot; beyond 12 hours. With this model:
      </P>
      <Bullets>
        <li>
          <Strong>Two days of usable warning instead of half a day.</Strong> At day +2 the error falls from {two.v2.toFixed(1)} to {two.model.toFixed(1)} µg/m³ on hazy days, a {cut}% reduction, which is
          the difference between a number that is no better than today&apos;s reading and one that tracks the next day&apos;s change.
        </li>
        <li>
          <Strong>Fewer false alarms when the index is high.</Strong> Two days ahead, {alarm("model")} of the model&apos;s forecast crossings of 150 did not happen, against {alarm("noChange")} for no change.
        </li>
        <li>
          <Strong>A map that explains itself.</Strong> The forecast rests on named inputs: which fire sectors, which wind direction, the physics smoke. The ablation says how much each contributes, so an
          assistant answer can say &quot;fires 300 to 800 km to the south-south-east, wind from them at 3 m/s&quot; with evidence behind it.
        </li>
        <li>
          <Strong>Portable.</Strong> No input names a place. Another region is a bounding box, an instrument list and a training run.
        </li>
      </Bullets>
      <P>
        <Strong>Rollout is gated.</Strong> The model runs in shadow mode first: every day it forecasts, nothing is shown, and the Simulation page scores it against the current forecast on the live DOE
        stations. It becomes the number people see only after 14 days with a 24 hour score at least 10% better. Until then every outlook, alert and assistant answer is unchanged.
      </P>
    </ModelChapter>
  );
}
