import type { ModelPerformance } from "@/lib/model-performance-schema";

import { percent } from "./table";

/** The verdict in plain words, above the chapters, with every figure read from the published file. */
export function Verdict({ data }: { data: ModelPerformance }) {
  const { nextDay } = data;
  const moves = nextDay.bigMoves;
  return (
    <div className="rounded-lg border border-accent-line bg-accent-tint p-4">
      <p className="max-w-[78ch] text-body text-ink-secondary">
        <strong className="font-medium text-ink">The verdict, in plain words.</strong> Tested on the 2026 haze season it had never seen ({data.stationDays} station-days at the Malaysian and Singapore reference
        stations, August to October), the model&apos;s next-day peak is within 10 µg/m³ of the truth on {percent(nextDay.within10.model)} of days and within 20 on {percent(nextDay.within20.model)}. When the
        air changed by 15 µg/m³ or more from one day to the next, it called the direction right {percent(moves.directionRight.model)} of the time, where the app&apos;s current forecast managed{" "}
        {percent(moves.directionRight.v2)}, a coin flip. It caught {percent(nextDay.cross150.hit.model)} of next-day crossings of the 150 line with {percent(nextDay.cross150.falseAlarm.model)} false alarms.
        Its clear weakness: it is timid. On those big moves it predicted on average {Math.round(moves.sizePredicted.model)} µg/m³ of change when {Math.round(moves.realSize)} happened, so it reads as
        &quot;the air stays roughly as bad as today&quot; when a sharp rise or fall was coming. Its band is also too narrow, covering {percent(data.bandCoverageHazy)} of hazy outcomes where 80% is the
        design. So: a forecast that knows which way the air is going and roughly how high, usable for a next-day alert, not yet one that calls the size of a sudden change. Chapter 5 shows this station by
        station.
      </p>
    </div>
  );
}
