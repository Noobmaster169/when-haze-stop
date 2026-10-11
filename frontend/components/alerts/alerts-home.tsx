"use client";

import { GetStarted } from "./get-started";
import { LatestAlerts } from "./latest-alerts";
import { MyAreas } from "./my-areas";
import { useFollows } from "./use-follows";

/** The top of the Alerts page: the one step to start while nothing is followed, then what was sent and each area's outlook. */
export function AlertsHome() {
  const follows = useFollows();
  if (!follows.ready) return <div aria-hidden className="h-40" />;
  if (follows.list.length === 0) return <GetStarted follows={follows} />;
  return (
    <>
      <LatestAlerts />
      <MyAreas follows={follows} />
    </>
  );
}
