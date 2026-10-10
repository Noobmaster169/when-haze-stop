"use client";

import Link from "next/link";

import { TONE } from "@/components/alerts/alert-tone";
import { useReplayLine } from "@/components/alerts/demo/replay-player";
import { Icon } from "@/components/ui/icons";

import { useUnseenAlert } from "./island-alert";
import { DESTINATIONS } from "./nav";

/**
 * The navigation, as a black pill in the middle of the banner. At rest it
 * names only the page one is on and shows the rest as icons; hovered or
 * reached by keyboard, it widens to name them all. Only keyboard focus holds
 * it open, so a click lands and the pill folds back around the new page.
 * Labels open on a grid track rather than a measured width, so the pill grows
 * to whatever the words need. Below 900px a new alert shows as a dot on the
 * Alerts icon, where wider screens hang its line under the pill.
 */
export function Island({ active }: { active: string | null }) {
  const { alert: unseen } = useUnseenAlert();
  const alert = useReplayLine() ?? unseen;
  return (
    <nav
      aria-label="Primary"
      className="group/island flex h-10 items-center gap-0.5 rounded-full bg-ink p-1 shadow-overlay transition-[padding,box-shadow] duration-500 ease-island hover:px-1.5 has-[:focus-visible]:px-1.5"
    >
      {DESTINATIONS.map((destination) => {
        const here = destination.key === active;
        return (
          <Link
            key={destination.key}
            href={destination.href}
            aria-current={here ? "page" : undefined}
            title={destination.label}
            className={`flex h-8 items-center rounded-full px-2.5 transition-colors duration-300 ease-island focus-visible:rounded-full! ${
              here ? "bg-ink-inverse/15 text-ink-inverse" : "text-ink-inverse/55 hover:bg-ink-inverse/10 hover:text-ink-inverse"
            }`}
          >
            <span className="relative shrink-0">
              <Icon name={destination.icon} />
              {destination.key === "alerts" && alert ? (
                <span aria-label="New alert" className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-ink min-[900px]:hidden ${TONE[alert.kind].dot}`} />
              ) : null}
            </span>
            <span
              className={`grid transition-[grid-template-columns,opacity] duration-500 ease-island ${
                here ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0 group-hover/island:grid-cols-[1fr] group-hover/island:opacity-100 group-has-[:focus-visible]/island:grid-cols-[1fr] group-has-[:focus-visible]/island:opacity-100"
              }`}
            >
              <span className="overflow-hidden whitespace-nowrap">
                <span className="pl-2 text-strong font-medium">{destination.label}</span>
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
