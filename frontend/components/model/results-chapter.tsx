import { Tile } from "@/components/simulation/chapter";
import type { ModelPerformance } from "@/lib/model-performance-schema";

import { ABLATION_DAYS, DAY_ONE, DAY_TWO, WITH_DOE } from "./backtest-figures";
import { AblationTable, DayAheadTable, MonthTable } from "./backtest-tables";
import { ModelChapter } from "./model-chapter";
import { H3, P } from "./prose";
import { Note } from "./table";

/** Chapter 4: the backtest's scores against every baseline, month by month, and what each input group is worth. */

type Trio = ModelPerformance["backtest"]["hazyMaeDay1"];

/** How much lower the model's error is than a baseline's, as a signed whole percent. */
function against(errors: Trio, baseline: "noChange" | "v2"): string {
  const change = Math.round((100 * (errors.model - errors[baseline])) / errors[baseline]);
  return `${change > 0 ? "+" : ""}${change}%`;
}

export function ResultsChapter({ backtest }: { backtest: ModelPerformance["backtest"] }) {
  const one = backtest.hazyMaeDay1;
  const two = backtest.hazyMaeDay2;
  return (
    <ModelChapter id="results">
      <P>
        Reference monitors are the rows where all four forecasts exist; in this history they are Singapore&apos;s five regions (DOE has one week of data, which falls in the last test month). Hazy means a
        true peak of 35 µg/m³ or more.
      </P>
      <div className="mt-4 space-y-5">
        <DayAheadTable table={DAY_ONE} hazy={one} />
        <DayAheadTable table={DAY_TWO} hazy={two} />
      </div>
      <Note>
        Hit 150: the share of days that really crossed API 150 which the forecast also put at 150 or above. False alarm 150: the share of forecast crossings that did not happen. Bootstrap 90% interval of
        the model&apos;s hazy-day error minus no change: -1.05 to -0.35 at day +1, -1.32 to -0.53 at day +2; minus v2: -1.34 to -0.67 and -2.20 to -1.32. All below zero.
      </Note>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile figure={against(one, "noChange")} label={`Day +1, hazy days: error against no change; ${against(one, "v2")} against the current forecast.`} />
        <Tile figure={against(two, "noChange")} label={`Day +2, hazy days: against no change; ${against(two, "v2")} against the current forecast.`} />
        <Tile figure={backtest.monthsWon} label="months won: lower all-day error than no change; lost January and June 2026 by under 0.8." />
        <Tile
          figure={WITH_DOE.hazyMae.toFixed(1)}
          label={`with DOE stations included: hazy MAE on ${WITH_DOE.days} days where physics exists; hit 150 of ${WITH_DOE.hit150.toFixed(2)}, false alarm ${WITH_DOE.falseAlarm150.toFixed(2)}.`}
        />
      </div>

      <H3>Month by month, day ahead, all days, reference rows</H3>
      <MonthTable />

      <H3>What each input group is worth</H3>
      <AblationTable ablation={backtest.ablation} />
      <Note>
        Ablation scored on the {ABLATION_DAYS} hazy reference days where the physics input exists, including DOE&apos;s October week, so these verdicts lean on one week at the DOE stations.
      </Note>
    </ModelChapter>
  );
}
