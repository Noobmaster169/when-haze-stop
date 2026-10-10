import { ModelChapter } from "./model-chapter";
import { Code, Formula, P } from "./prose";

/** Chapter 1: the target, exactly. */

const TARGET = `y1(i, t) = max over the hours of Malaysian day t+1 of the 24 h mean PM2.5 at i      (µg/m³)
y2(i, t) = the same for day t+2`;

export function TargetChapter() {
  return (
    <ModelChapter id="target">
      <P>
        For every instrument <Code>i</Code> (a DOE station, a Singapore region, a low-cost sensor, an airport) and every issue day <Code>t</Code> at 08:00 Malaysian time, the target is the highest 24 hour
        mean PM2.5 of the next day and of the day after, in micrograms per cubic metre. DOE&apos;s API index is the 24 hour mean passed through a fixed table, so predicting the concentration predicts the
        index.
      </P>
      <Formula>{TARGET}</Formula>
    </ModelChapter>
  );
}
