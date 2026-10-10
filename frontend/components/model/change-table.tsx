import type { ModelPerformance } from "@/lib/model-performance-schema";

import { Label, Num, Row, Table, highestBest, lowestBest, percent, type Tone } from "./table";

/** Does it predict change: the model, the current forecast and no change on identical station-days, every figure from the published file. */

type Trio = ModelPerformance["nextDay"]["within10"];
type Cell = { text: string; tone: Tone; words?: boolean };

const ORDER = ["model", "v2", "noChange"] as const;

function trio(values: Trio, format: (value: number) => string, best: (values: number[]) => Tone[]): Cell[] {
  const tones = best(ORDER.map((key) => values[key]));
  return ORDER.map((key, index) => ({ text: format(values[key]), tone: tones[index] }));
}

function Line({ label, cells }: { label: string; cells: Cell[] }) {
  return (
    <Row>
      <Label>{label}</Label>
      {cells.map((cell, index) => (
        <Num key={index} tone={cell.tone} words={cell.words}>
          {cell.text}
        </Num>
      ))}
    </Row>
  );
}

export function ChangeTable({ data }: { data: ModelPerformance }) {
  const { nextDay, twoDays } = data;
  const moves = nextDay.bigMoves;
  const direction = highestBest([moves.directionRight.model, moves.directionRight.v2]);
  const crossTwo = twoDays.cross150;
  const crossTwoTones = highestBest(ORDER.map((key) => crossTwo.hit[key]));
  const fixed = (value: number): string => value.toFixed(2);
  const one = (value: number): string => value.toFixed(1);
  return (
    <Table head={[`Next day, ${data.stationDays} station-days`, "Model", "Current forecast", "No change"]}>
      <Line label="Within 10 µg/m³ of the real peak" cells={trio(nextDay.within10, percent, highestBest)} />
      <Line label="Within 20 µg/m³" cells={trio(nextDay.within20, percent, highestBest)} />
      <Line label="Correlation, forecast against real peak" cells={trio(nextDay.corr, fixed, highestBest)} />
      <Line
        label="Correlation, forecast change against real change"
        cells={[...trio(nextDay.changeCorr, fixed, highestBest).slice(0, 2), { text: "0 by definition", tone: "plain", words: true }]}
      />
      <Line
        label={`Big moves (real change of 15 µg/m³ or more, ${moves.cases} cases): direction right`}
        cells={[
          { text: percent(moves.directionRight.model), tone: direction[0] },
          { text: percent(moves.directionRight.v2), tone: direction[1] },
          { text: "never moves", tone: "plain", words: true },
        ]}
      />
      <Line
        label={`Big moves: size predicted, average, against ${one(moves.realSize)} real`}
        cells={[
          { text: one(moves.sizePredicted.model), tone: "worse" },
          { text: one(moves.sizePredicted.v2), tone: "worse" },
          { text: "0", tone: "worse" },
        ]}
      />
      <Line label={`Crossed 150 next day (${nextDay.cross150.events} events): caught`} cells={trio(nextDay.cross150.hit, percent, highestBest)} />
      <Line label="Forecast crossings that did not happen" cells={trio(nextDay.cross150.falseAlarm, percent, lowestBest)} />
      <Line label="Two days ahead: within 20 µg/m³" cells={trio(twoDays.within20, percent, highestBest)} />
      <Line
        label={`Two days ahead: crossed 150 (${crossTwo.events} events), caught / false`}
        cells={ORDER.map((key, index) => ({ text: `${percent(crossTwo.hit[key])} / ${percent(crossTwo.falseAlarm[key])}`, tone: crossTwoTones[index] }))}
      />
    </Table>
  );
}
