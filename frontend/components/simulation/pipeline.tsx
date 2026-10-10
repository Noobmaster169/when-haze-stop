import type { SimulationRun } from "@/lib/api/simulation-schemas";

/**
 * One run, in the order it happens, each step with the newest run's own
 * figures. A headline and one line per step.
 */

interface Step {
  title: string;
  figure: string;
  line: string;
}

function steps(run: SimulationRun): Step[] {
  const number = (value: number): string => value.toLocaleString("en-GB");
  return [
    {
      title: "Fires",
      figure: `${number(run.fireCells)} cells, ${number(run.firePowerMw)} MW`,
      line: `NASA satellites, ${run.fireDay ?? "newest day"}. Unseen days burn at the last three days' mean.`,
    },
    { title: "Wind and rain", figure: `${number(run.weatherPoints)} points, ${number(run.weatherHours)} h`, line: "Open-Meteo at 925 and 850 hPa, where smoke travels, about 1 km up." },
    { title: "Particles", figure: `${run.members} runs × 6 a fire a day`, line: "Each carried hour by hour on the wind, spread by turbulence, thinned by time and rain." },
    { title: "Smoke at stations", figure: "within 50 km, 24 h mean", line: "Matches what DOE's index measures: a day-long average around the station." },
    {
      title: "Calibrate",
      figure: `${number(run.pairs)} station-hours, rank ${run.rankCorrelation?.toFixed(2) ?? "n/a"}`,
      line: "Smoke turned into PM2.5 by a straight-line fit to the readings the run could see.",
    },
    { title: "Forecast and map", figure: "84 h ahead", line: "Stations from their own readings; the map from the smoke where no station reads." },
  ];
}

export function Pipeline({ run }: { run: SimulationRun }) {
  return (
    <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {steps(run).map((step, index) => (
        <li key={step.title} className="relative rounded-lg border border-hairline bg-surface p-4">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-caption text-accent">{index + 1}</span>
            <span className="text-title font-medium text-ink">{step.title}</span>
          </div>
          <div className="mt-1 font-mono text-small text-ink">{step.figure}</div>
          <p className="mt-1 text-small text-ink-secondary">{step.line}</p>
        </li>
      ))}
    </ol>
  );
}
