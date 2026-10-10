import type { ModelPerformance } from "@/lib/model-performance-schema";

import { InputsTable } from "./inputs-table";
import { ModelChapter } from "./model-chapter";
import { Bullets, Code, Formula, H3, P, Strong } from "./prose";
import { WorkedExample } from "./worked-example";

/** Chapter 2: the sum of trees, its 108 inputs, how fires to the south and east reach it, and one real row run through it. */

const FUNCTION = `ŷq(i, t) = Fq(x)  =  Σ k=1..600  Tk(x)         q in {0.10, 0.50, 0.90}, one Fq per target day

x is a vector of 108 numbers built only from data known at 08:00 on day t.
Each tree Tk splits on a few of those numbers ("is x12 above 55.4?", "is x47 above 50,000?")
and returns a constant for the leaf the row falls into. The forecast is the sum of the leaves.`;

function issuedOn(issued: string): string {
  const [day, time] = issued.split(" ");
  const date = new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return `${date} at ${time}`;
}

export function FunctionChapter({ example }: { example: ModelPerformance["example"] }) {
  return (
    <ModelChapter id="function">
      <P>
        The model is a sum of 600 small decision trees, fitted by gradient boosting (LightGBM). There is one such sum for each quantile and each day: the 50th percentile is the forecast, the 10th and
        90th are the band.
      </P>
      <Formula>{FUNCTION}</Formula>

      <H3>The 108 inputs, by group</H3>
      <InputsTable />

      <H3>Fires to the south and to the east: what happens to them</H3>
      <P>
        They are never added into one number by hand. Each becomes its own input. A fire 900 km to the south-south-east of a station lands in <Code>fire_s3_r2</Code>; a fire 200 km east lands in{" "}
        <Code>fire_s2_r0</Code>. Three things then connect them to the forecast:
      </P>
      <Bullets>
        <li>
          <Strong>The trees learn each sector&apos;s effect from history.</Strong> A split such as &quot;fire_s3_r1_d7 above 25,000 MW&quot; raises the leaf value because, across 16 months, large fires in
          that sector preceded high readings at that instrument. The ablation shows these 75 inputs reduce hazy-day error by 3%.
        </li>
        <li>
          <Strong>
            The wind decides which sector counts, through conditional splits and through <Code>along_fire24</Code>.
          </Strong>{" "}
          That input is the projection of the next day&apos;s wind onto the line from the heaviest fire sector to the instrument: <Code>u·sin(b+180) + v·cos(b+180)</Code> where <Code>b</Code> is the
          bearing to the fires. Positive means the wind carries smoke from the fires toward the station. A tree can split on &quot;along_fire24 above 2 m/s and fire_s3_r2_d3 above 50,000&quot;, which is
          the rule &quot;big fires upwind&quot;.
        </li>
        <li>
          <Strong>The physics input already did the geometry.</Strong> The transport model advected real particles from every fire with the real wind field hour by hour. Its 48 h value is the most direct
          statement of &quot;how much of that southern and eastern smoke reaches here&quot;, and the trees learn how far to trust it (removing it costs 5%).
        </li>
      </Bullets>

      <H3>
        One real row, {example.station}, issued {issuedOn(example.issued)}
      </H3>
      <WorkedExample example={example} />
    </ModelChapter>
  );
}
