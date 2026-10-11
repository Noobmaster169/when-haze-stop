"use client";

import { type PointerEvent, useEffect, useRef } from "react";

import type { StoredDay } from "@/lib/api/haze-schemas";
import { dayName } from "@/lib/malaysia-time";

import { airBand, dayLines, fireHeight, hazeShare, monthMarks, windState } from "./history-days";
import { BAND_SWATCH } from "./scale";

/**
 * Every stored day as one column of four marks: a bar of fire power, then
 * whether its wind is stored, how many airports reported haze, and the PM2.5
 * that was measured. Pressing a column puts that day on the map, dragging
 * along the strip runs through the days, and Live goes back to now. The day
 * marked is the one the timeline is in. The days are UTC days, as the
 * satellites' files count them.
 *
 * The strip scrolls, a fixed width a day, and opens on the newest days: two
 * years of days do not fit across a screen.
 */

interface Props {
  days: StoredDay[];
  day: string | null;
  onChoose(day: string | null): void;
}

const DAY_PX = 5;
const ROWS = ["Fires", "Wind", "Visibility", "PM2.5"];
const WIND = { full: "bg-ink-tertiary", part: "bg-hairline-strong", none: "" };

export function HistoryStrip({ days, day, onChoose }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const newest = days.at(-1)?.day;
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [newest]);

  // The timeline can walk the day out of sight; the strip follows it.
  const index = days.findIndex((entry) => entry.day === day);
  useEffect(() => {
    const element = scroller.current;
    if (!element || index < 0) return;
    const left = index * DAY_PX;
    if (left < element.scrollLeft || left > element.scrollLeft + element.clientWidth - DAY_PX) element.scrollLeft = left - element.clientWidth / 2;
  }, [index]);

  /** A mouse held down and drawn along the strip chooses each day it passes. Touch scrolls the strip instead. */
  const scrub = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.pointerType !== "mouse" || event.buttons !== 1) return;
    const passed = days[Math.floor((event.clientX - event.currentTarget.getBoundingClientRect().left) / DAY_PX)];
    if (passed && passed.day !== day) onChoose(passed.day);
  };

  if (days.length === 0) return null;
  const largest = Math.max(...days.map((entry) => entry.frpMw), 1);
  const chosen = days[index] ?? null;

  return (
    <div className="shrink-0 border-t border-hairline bg-canvas px-4 py-2 md:px-6">
      <div className="flex items-center gap-x-3">
        <div className="w-[200px] shrink-0">
          <p className="text-strong font-medium text-ink">{chosen ? `${dayName(chosen.day)} ${chosen.day.slice(0, 4)}` : "History"}</p>
          {chosen ? (
            dayLines(chosen).map((line) => (
              <p key={line} className="truncate text-caption text-ink-tertiary">
                {line}
              </p>
            ))
          ) : (
            <p className="text-caption text-ink-tertiary">
              Fires, wind, visibility and PM2.5 by day since {dayName(days[0].day)} {days[0].day.slice(0, 4)}
            </p>
          )}
        </div>
        <div aria-hidden="true" className="hidden shrink-0 flex-col items-end gap-0.5 pt-3.5 text-[9px] leading-[8px] text-ink-tertiary sm:flex">
          <span className="flex h-8 items-end">{ROWS[0]}</span>
          {ROWS.slice(1).map((row) => (
            <span key={row} className="h-2">
              {row}
            </span>
          ))}
        </div>
        <div ref={scroller} className="min-w-0 grow overflow-x-auto overscroll-x-contain">
          <div className="relative" style={{ width: days.length * DAY_PX }}>
            <div aria-hidden="true" className="relative h-3.5 text-micro leading-3 text-ink-tertiary">
              {monthMarks(days).map((mark) => (
                <span key={mark.index} className="absolute top-0 whitespace-nowrap border-l border-hairline-strong pl-1" style={{ left: mark.index * DAY_PX }}>
                  {mark.label}
                </span>
              ))}
            </div>
            <div className="flex" role="group" aria-label="Choose a past day" onPointerMove={scrub}>
              {days.map((entry) => {
                const on = entry.day === day;
                const band = airBand(entry);
                const haze = hazeShare(entry);
                return (
                  <button
                    key={entry.day}
                    type="button"
                    title={`${dayName(entry.day)} ${entry.day.slice(0, 4)}: ${dayLines(entry).join(". ")}.`}
                    aria-label={`Show ${dayName(entry.day)} ${entry.day.slice(0, 4)}`}
                    aria-pressed={on}
                    onClick={() => onChoose(entry.day)}
                    style={{ width: DAY_PX }}
                    className={`group flex shrink-0 flex-col gap-0.5 pr-px ${on ? "bg-accent-tint" : "hover:bg-active"}`}
                  >
                    <span className="flex h-8 w-full items-end">
                      <span style={{ height: `${fireHeight(entry.frpMw, largest)}%` }} className={`w-full rounded-t-[1px] ${on ? "bg-accent" : "bg-hairline-strong group-hover:bg-ink-tertiary"}`} />
                    </span>
                    <span className={`h-2 w-full ${WIND[windState(entry)]}`} />
                    <span className="h-2 w-full bg-ink" style={{ opacity: haze === null ? 0 : 0.12 + haze * 0.88 }} />
                    <span className={`h-2 w-full ${band ? BAND_SWATCH[band] : ""}`} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChoose(null)}
          disabled={!day}
          className="h-8 shrink-0 rounded-md border border-hairline-strong px-3 text-small font-medium text-ink-secondary hover:bg-active hover:text-ink disabled:cursor-default disabled:text-ink-faint disabled:hover:bg-transparent"
        >
          Live
        </button>
      </div>
    </div>
  );
}
