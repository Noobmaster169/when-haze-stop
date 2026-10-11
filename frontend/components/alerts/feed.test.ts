import { describe, expect, it } from "vitest";

import type { AlertEvent } from "@/lib/api/alert-schemas";

import { clampStep, LAST_STEP, replayAlertsAt } from "./demo/replay";
import { feedOrder, toastsFrom } from "./feed-order";
import { hasSeen, NOTHING_SEEN, parseSeen, withSeen } from "./seen-state";

/** Alerts as the live feed carried them on 10 and 11 October 2026. */
function alert(id: number, open: boolean, kind: AlertEvent["kind"] = "order"): AlertEvent {
  return {
    id,
    stationId: "CA11A",
    stationName: "Tasek Ipoh",
    kind,
    threshold: 112,
    message: "Ministry of Education: Schools in the Kinta and Kuala Kangsar districts of Perak closed due to haze.",
    open,
    createdAt: "2026-10-11T00:21:26.746Z",
  };
}

describe("what has been read", () => {
  it("counts everything under the old line's mark as read, and each id closed since", () => {
    const seen = withSeen({ floor: 100, ids: [] }, [140]);
    expect(hasSeen(seen, 90)).toBe(true);
    expect(hasSeen(seen, 140)).toBe(true);
    expect(hasSeen(seen, 120)).toBe(false);
  });

  it("keeps the newest two hundred and folds the rest into the floor", () => {
    const many = withSeen(NOTHING_SEEN, Array.from({ length: 205 }, (_, index) => index + 1));
    expect(many.ids).toHaveLength(200);
    expect(many.floor).toBe(5);
    expect(hasSeen(many, 3)).toBe(true);
  });

  it("reads what storage holds without trusting it", () => {
    expect(parseSeen("42", "[7, 9]")).toEqual({ floor: 42, ids: [7, 9] });
    expect(parseSeen(null, "not json")).toEqual({ floor: 0, ids: [] });
    expect(parseSeen("x", '[1, "2", 3.5]')).toEqual({ floor: 0, ids: [1] });
  });
});

describe("the toasts", () => {
  it("raise only unread alerts still in force, newest on top, three at most", () => {
    const events = [alert(1, true), alert(2, false), alert(3, true, "observed"), alert(4, true), alert(5, true), alert(6, true), alert(7, true)];
    const { toasts, more } = toastsFrom(events, withSeen(NOTHING_SEEN, [7]));
    expect(toasts.map((event) => event.id)).toEqual([6, 5, 4]);
    expect(more).toBe(1);
  });
});

describe("the page's list", () => {
  it("puts active alerts first, then ended ones, newest first in each, and leaves out old observed rows", () => {
    const events = [alert(10, false), alert(11, true), alert(12, false), alert(9, true), alert(13, true, "observed")];
    expect(feedOrder(events).map((event) => event.id)).toEqual([11, 9, 12, 10]);
  });
});

describe("the replay", () => {
  it("keeps its step between the first and the last", () => {
    expect(clampStep(0)).toBe(1);
    expect(clampStep(LAST_STEP + 3)).toBe(LAST_STEP);
  });

  it("has sent nothing at the rule, then the forecast, then the order above it", () => {
    expect(replayAlertsAt(1)).toEqual([]);
    expect(replayAlertsAt(2).map((sent) => sent.alert.kind)).toEqual(["arriving"]);
    expect(replayAlertsAt(LAST_STEP).map((sent) => sent.alert.kind)).toEqual(["order", "arriving"]);
  });
});
