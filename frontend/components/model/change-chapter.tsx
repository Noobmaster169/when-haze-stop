import type { ModelPerformance } from "@/lib/model-performance-schema";

import { ChangeScatter } from "./change-scatter";
import { ChangeTable } from "./change-table";
import { ModelChapter } from "./model-chapter";
import { H3, P } from "./prose";
import { dayLabel } from "./scale";
import { SeriesLegend } from "./series-legend";
import { StationChart } from "./station-chart";
import { Note, percent } from "./table";

/** Chapter 5: whether the model sees a change coming, in a table, a scatter of every station-day, and four stations day by day. */

const card = "rounded-lg border border-hairline bg-surface p-4";

function span(rows: ModelPerformance["series"][number]["rows"]): string {
  return `${dayLabel(rows[0].day)} to ${dayLabel(rows[rows.length - 1].day)} 2026, ${rows.length} days`;
}

export function ChangeChapter({ data }: { data: ModelPerformance }) {
  const { doeOnly, neaOnly } = data;
  return (
    <ModelChapter id="change">
      <P>
        Averages hide the thing that matters most. These are the last three unseen months, August to October 2026, re-run exactly as the backtest does (train on everything before the month, forecast the
        month), at the Malaysian DOE stations (6 days, 340 station-days) and the five Singapore regions (345). Three forecasts are compared on identical days: the model, the app&apos;s current hourly
        forecast, and &quot;no change&quot; (tomorrow&apos;s peak equals today&apos;s).
      </P>
      <div className="mt-4">
        <ChangeTable data={data} />
      </div>
      <Note>
        DOE stations alone (3 to 8 October): within 20 µg/m³ {percent(doeOnly.within20)}, crossings of 150 caught {percent(doeOnly.hit150)} with {percent(doeOnly.falseAlarm150)} false alarms, change
        correlation {doeOnly.changeCorr.toFixed(2)}. Singapore alone (August to October): within 20 µg/m³ {percent(neaOnly.within20)}, crossings caught {percent(neaOnly.hit150)} with{" "}
        {percent(neaOnly.falseAlarm150)} false alarms.
      </Note>

      <H3>Real change against forecast change, every station-day</H3>
      <div className={card}>
        <ChangeScatter points={data.scatter} />
        <p className="mt-1 text-caption text-ink-tertiary">
          Each dot is one of {data.scatter.length} station-days. A perfect forecast sits on the diagonal. The cloud leans the right way but is flattened: the model moves in the right direction and
          under-shoots the size.
        </p>
      </div>

      <H3>Each station, next-day peak</H3>
      <SeriesLegend />
      <div className="mt-3 space-y-3">
        {data.series.map((series) => (
          <figure key={series.id} className={card}>
            <figcaption className="flex items-baseline justify-between gap-2">
              <span className="text-small font-medium text-ink">{series.name}</span>
              <span className="text-caption text-ink-tertiary">{span(series.rows)}</span>
            </figcaption>
            <div className="mt-1">
              <StationChart series={series} />
            </div>
          </figure>
        ))}
      </div>
      <P>
        Read the Singapore series: the model tracks the slow rise through early October and stays inside its band, but on 14 and 15 September and on 29 September the air jumped by 40 to 70 µg/m³ in a day
        and the model moved by 5 to 10. &quot;No change&quot; missed those too, one day later. At Shah Alam the model lagged the 6 to 7 October rise by a day, then sat on it. That lag on sharp rises is the
        single most important thing to fix: the inputs that could see it coming (fires upwind, wind from them) are there, and the model under-weights them against today&apos;s reading.
      </P>
    </ModelChapter>
  );
}
