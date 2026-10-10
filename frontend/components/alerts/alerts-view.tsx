"use client";

import Link from "next/link";

import { PlaceSearch } from "@/components/map/place-search";
import { Icon } from "@/components/ui/icons";

import { AlertList } from "./alert-list";
import { useFollows } from "./use-follows";

/** The alerts page: the areas this browser follows, a way to add one, and what has been said. */
export function AlertsView() {
  const follows = useFollows();
  return (
    <div className="max-w-[760px] space-y-9">
      <section>
        <h2 className="text-title font-medium text-ink">My areas</h2>
        <p className="mt-1 text-small text-ink-secondary">Search a town. You follow the DOE station nearest to it, because that is where its readings come from.</p>
        <div className="relative z-10 mt-3">
          <PlaceSearch
            onChoose={(place) => {
              if (place.nearest) void follows.follow(place.nearest.id);
            }}
          />
        </div>

        {follows.ready && follows.list.length === 0 ? <p className="mt-4 text-small text-ink-tertiary">You are not following any area yet.</p> : null}
        <ul className="mt-4 divide-y divide-hairline-faint border-y border-hairline-faint empty:hidden">
          {follows.list.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2">
              <Icon name="bell" size={14} className="shrink-0 text-accent" />
              <span className="min-w-0 grow truncate text-body text-ink">{item.stationName}</span>
              <Link href={`/map?station=${item.stationId}`} className="text-small text-ink-secondary underline-offset-2 hover:text-accent hover:underline">
                Show on map
              </Link>
              <button type="button" onClick={() => void follows.unfollow(item.stationId)} className="h-7 rounded-sm px-2 text-small text-ink-tertiary hover:bg-active hover:text-fault">
                Stop
              </button>
            </li>
          ))}
        </ul>
      </section>

      <AlertList following={follows.list.length > 0} />

      <section>
        <h2 className="text-title font-medium text-ink">What you are told</h2>
        <dl className="mt-3 space-y-2.5 text-small">
          <div className="flex gap-3">
            <dt className="w-[68px] shrink-0 text-caption font-semibold uppercase tracking-[0.04em] text-fault">Now</dt>
            <dd className="text-ink-secondary">A reading has passed an official line: 100, 150, 180 or 200.</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-[68px] shrink-0 text-caption font-semibold uppercase tracking-[0.04em] text-differ">Forecast</dt>
            <dd className="text-ink-secondary">The forecast gives at least a 60% chance that tomorrow passes a line the reading is still under.</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-[68px] shrink-0 text-caption font-semibold uppercase tracking-[0.04em] text-match">Clearing</dt>
            <dd className="text-ink-secondary">The air is unhealthy now and the forecast expects a coming day to stay under 100.</dd>
          </div>
        </dl>
        <p className="mt-3 text-small text-ink-tertiary">Each is said once, when it starts. It can be said again only after it has ended. Alerts show at the top of this app while it is open.</p>
      </section>
    </div>
  );
}
