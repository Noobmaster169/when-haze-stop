"use client";

import { useState, type ReactNode } from "react";

import type { Station } from "@/lib/model-performance-schema";

import { KIND_LABEL } from "./figures";
import { sortStations, type Direction, type SortKey } from "./scorecard-sort";
import { percent } from "./table";

/**
 * Every instrument's next-day score in one table, sortable by any column.
 * Two cells have a no-change answer to compare with, mean error and crossings
 * caught; they are washed green where the model does better and red where it
 * does worse. A dash is a share with nothing to count.
 */

const COLUMNS: { key: SortKey; label: string; title: string }[] = [
  { key: "name", label: "Instrument", title: "Instrument name, with its kind" },
  { key: "days", label: "Days", title: "Station-days scored" },
  {
    key: "within20",
    label: "Within 20",
    title: "Share of next-day peaks within 20 µg/m³",
  },
  {
    key: "hit150",
    label: "Caught 150",
    title: "Share of real crossings of API 150 the model called, against no change",
  },
  {
    key: "falseAlarm150",
    label: "False alarm",
    title: "Share of the model's called crossings that did not happen",
  },
  {
    key: "directionRight",
    label: "Direction",
    title: "Direction right on days the peak moved 15 µg/m³ or more",
  },
  {
    key: "mae",
    label: "Error",
    title: "Mean absolute error in µg/m³, against no change",
  },
];

const WASH = { better: "bg-match-tint", worse: "bg-fault-tint", same: "" };

function wash(model: number | null, noChange: number | null, higherWins: boolean): string {
  if (model === null || noChange === null || model === noChange) return WASH.same;
  return model > noChange === higherWins ? WASH.better : WASH.worse;
}

const share = (value: number | null): string => (value === null ? "-" : percent(value));

function Cell({ children, tone = "" }: { children: ReactNode; tone?: string }) {
  return <td className={`whitespace-nowrap px-3 py-1.5 text-right font-mono text-mono-sm tabular-nums text-ink ${tone}`}>{children}</td>;
}

function ScoreRow({ station }: { station: Station }) {
  const score = station.score;
  return (
    <tr className="border-t border-hairline-faint">
      <td className="py-1.5 pr-3 pl-3 text-small">
        <span className="block max-w-[240px] truncate text-ink" title={station.name}>
          {station.name}
        </span>
        <span className="block text-caption text-ink-tertiary">{station.state ? `${KIND_LABEL[station.kind]}, ${station.state}` : KIND_LABEL[station.kind]}</span>
      </td>
      <Cell>{score.days}</Cell>
      <Cell>{percent(score.within20)}</Cell>
      <Cell tone={wash(score.hit150, score.hitNoChange, true)}>
        {share(score.hit150)}
        {score.hitNoChange === null ? null : <span className="text-ink-tertiary"> / {percent(score.hitNoChange)}</span>}
      </Cell>
      <Cell>{share(score.falseAlarm150)}</Cell>
      <Cell>{share(score.directionRight)}</Cell>
      <Cell tone={wash(score.mae, score.maeNoChange, false)}>
        {score.mae.toFixed(1)}
        <span className="text-ink-tertiary"> / {score.maeNoChange.toFixed(1)}</span>
      </Cell>
    </tr>
  );
}

export function Scorecard({ stations }: { stations: readonly Station[] }) {
  const [sort, setSort] = useState<{
    key: SortKey | null;
    direction: Direction;
  }>({ key: null, direction: "up" });
  const rows = sortStations(stations, sort.key, sort.direction);
  const choose = (key: SortKey): void =>
    setSort((current) => (current.key === key ? { key, direction: current.direction === "up" ? "down" : "up" } : { key, direction: key === "name" ? "up" : "down" }));

  return (
    <div className="max-h-[640px] overflow-auto rounded-md border border-hairline-faint">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-canvas">
          <tr className="text-caption text-ink-tertiary">
            {COLUMNS.map((column, index) => {
              const active = sort.key === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={active ? (sort.direction === "up" ? "ascending" : "descending") : "none"}
                  className={`py-1.5 font-normal ${index === 0 ? "pr-3 pl-3 text-left" : "px-3 text-right"}`}
                >
                  <button type="button" title={column.title} onClick={() => choose(column.key)} className={`whitespace-nowrap hover:text-ink ${active ? "text-ink" : ""}`}>
                    {column.label}
                    {active ? (sort.direction === "up" ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((station) => (
            <ScoreRow key={station.id} station={station} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
