import { Tile } from "@/components/simulation/chapter";
import type { ModelPerformance } from "@/lib/model-performance-schema";

import { DataFlow } from "./data-flow";
import { Glossary } from "./glossary";
import { ModelChapter } from "./model-chapter";
import { H3 } from "./prose";

/**
 * Chapter 1, for a reader with no context: what goes in and comes out, the
 * words every later chart uses, and the size of the test. The training span
 * is not in the published scores file, so it is read from the report's
 * parquet name (2025-06-07 on) and its first test month (August 2026).
 */

const TRAINING = { figure: "14 months", label: "of training before the test, June 2025 to July 2026" };

export function DataChapter({ data }: { data: ModelPerformance }) {
  const count = (kind: ModelPerformance["stations"][number]["kind"]): number => data.stations.filter((station) => station.kind === kind).length;
  return (
    <ModelChapter id="data">
      <DataFlow />
      <H3>The words on every chart</H3>
      <Glossary />
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile figure={`${data.instruments} instruments`} label={`${count("doe")} DOE stations, ${count("nea")} Singapore regions, ${count("openaq")} sensors`} />
        <Tile figure={`${data.stationDays.toLocaleString("en-GB")} station-days`} label={`the test, ${data.testSpan}`} />
        <Tile figure={TRAINING.figure} label={TRAINING.label} />
      </div>
    </ModelChapter>
  );
}
