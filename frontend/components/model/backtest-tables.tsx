import type { ModelPerformance } from "@/lib/model-performance-schema";

import { ABLATION_FULL_MAE, ABLATION_MAE, MONTHS, REFERENCE_DAYS, type DayTable } from "./backtest-figures";
import { Label, Num, Row, Table, Text, highestBest, lowestBest, type Tone } from "./table";

/** The backtest as tables: each forecast by day ahead, the model month by month, and what each input group is worth. */

type Backtest = ModelPerformance["backtest"];

/** Lowest wins for the errors and false alarms, highest for the hits; climatology is marked worse where it trails far behind. */
export function DayAheadTable({ table, hazy }: { table: DayTable; hazy: Backtest["hazyMaeDay1"] }) {
  const hazyOf = (row: DayTable["rows"][number]): number => (row.key ? hazy[row.key] : row.hazyMae);
  const all = lowestBest(table.rows.map((row) => row.allMae));
  const hazyTones = lowestBest(table.rows.map(hazyOf));
  const hits = highestBest(table.rows.map((row) => row.hit150));
  const alarms = lowestBest(table.rows.map((row) => row.falseAlarm150 ?? Number.POSITIVE_INFINITY));
  const last = table.rows.length - 1;
  return (
    <Table head={[`${table.label}, reference rows (${REFERENCE_DAYS.toLocaleString("en-GB")} days, ${table.hazyDays} hazy)`, "All days MAE", "Hazy days MAE", "Hit 150", "False alarm 150"]}>
      {table.rows.map((row, index) => (
        <Row key={row.name}>
          <Label>{row.name}</Label>
          <Num tone={index === last ? "worse" : all[index]}>{row.allMae.toFixed(2)}</Num>
          <Num tone={index === last ? "worse" : hazyTones[index]}>{hazyOf(row).toFixed(2)}</Num>
          <Num tone={hits[index]}>{row.hit150.toFixed(2)}</Num>
          <Num tone={row.falseAlarm150 === null ? "plain" : alarms[index]}>{row.falseAlarm150?.toFixed(2) ?? ""}</Num>
        </Row>
      ))}
    </Table>
  );
}

export function MonthTable() {
  return (
    <Table head={["Test month", "Trained on", "Model", "No change", "v2"]}>
      {MONTHS.map(([month, trained, ...errors]) => {
        const tones = lowestBest(errors);
        return (
          <Row key={month}>
            <Label>{month}</Label>
            <Num>{trained.toLocaleString("en-GB")}</Num>
            {errors.map((value, index) => (
              <Num key={index} tone={tones[index]}>
                {value.toFixed(2)}
              </Num>
            ))}
          </Row>
        );
      })}
    </Table>
  );
}

/** A group that raises the error when removed earns its place; one that lowers it is dropped. */
export function AblationTable({ ablation }: { ablation: Backtest["ablation"] }) {
  return (
    <Table head={["Group removed", "Hazy MAE without it", "Change", "Kept"]} textFrom={3}>
      <Row>
        <Label>None (full model)</Label>
        <Num>{ABLATION_FULL_MAE.toFixed(2)}</Num>
        <Num />
        <Text>{""}</Text>
      </Row>
      {ablation.map(([group, change]) => {
        const tone: Tone = change > 0 ? "worse" : "best";
        const without = ABLATION_MAE[group];
        return (
          <Row key={group}>
            <Label>{group}</Label>
            <Num tone={tone}>{without === undefined ? "" : without.toFixed(2)}</Num>
            <Num tone={tone}>{`${change > 0 ? "+" : ""}${(change * 100).toFixed(1)}%`}</Num>
            <Text>{change > 0 ? "yes" : "no, it hurts"}</Text>
          </Row>
        );
      })}
    </Table>
  );
}
