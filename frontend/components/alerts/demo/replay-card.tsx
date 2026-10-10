"use client";

import { useEffect } from "react";

import { TONE } from "@/components/alerts/alert-tone";
import { Icon } from "@/components/ui/icons";

import { OUTCOME, REPLAY, REPLAY_PLACE, RULE } from "./replay";
import { playReplay, stopReplay, useReplay } from "./replay-player";

/** The replay as a timeline that fills in as each alert arrives. */

const DEVICE_NOTE = {
  shown: "Each alert also went to this device as a notification.",
  blocked: "Notifications are off for this site, so the alerts show here and under the island only.",
  unsupported: "This browser cannot show notifications, so the alerts show here and under the island only.",
};

/** A step of the timeline, which drops in when it happens, as the alert does under the island. */
function Moment({ at, dot, label, children, live }: { at: string; dot: string; label: string; children: React.ReactNode; live: boolean }) {
  if (!live) return null;
  return (
    <li className="relative animate-[island-drop_400ms_var(--ease-island)] pb-5 pl-6 last:pb-0">
      <span aria-hidden className={`absolute top-1.5 left-0 h-2.5 w-2.5 rounded-full ${dot}`} />
      <p className="text-caption text-ink-tertiary">
        <span className="font-medium text-ink-secondary">{at}</span>
        <span className="ml-2">{label}</span>
      </p>
      <div className="mt-0.5 text-body text-ink">{children}</div>
    </li>
  );
}

export function ReplayCard() {
  const replay = useReplay();
  useEffect(() => {
    if (!replay.open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && stopReplay();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [replay.open]);
  if (!replay.open) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-canvas/70 p-3 pt-28 sm:items-center" onClick={stopReplay}>
      <div role="dialog" aria-modal="true" aria-label={`Replay of ${REPLAY_PLACE}`} onClick={(event) => event.stopPropagation()} className="w-full max-w-[520px] rounded-xl border border-hairline bg-surface p-5 shadow-overlay">
        <header className="flex items-start gap-3">
          <div className="min-w-0 grow">
            <p className="text-caption font-semibold tracking-[0.04em] text-accent uppercase">Replay</p>
            <h2 className="mt-0.5 font-display text-[21px] leading-7 text-ink">{REPLAY_PLACE}, 8 October 2026</h2>
            <p className="mt-1 text-small text-ink-secondary">What a parent following Seremban would have been told. Real readings, forecast and statements; nothing is sent to anyone else.</p>
          </div>
          <button type="button" onClick={stopReplay} aria-label="Close the replay" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-ink-tertiary hover:bg-active hover:text-ink">
            <Icon name="close" size={13} />
          </button>
        </header>

        <ol className="mt-5 border-l border-hairline pl-0 [&>li]:-ml-[5px]">
          <Moment at={RULE.at} dot="bg-ink-faint" label="Official rule" live>
            <span className="text-ink-secondary">{RULE.text}</span>
          </Moment>
          {REPLAY.map((alert, index) => (
            <Moment key={alert.kind} at={alert.at} dot={TONE[alert.kind].dot} label={`${TONE[alert.kind].label} alert sent`} live={replay.arrived > index}>
              <p>{alert.message}</p>
              <a href={alert.source.url} target={alert.source.url.startsWith("/") ? undefined : "_blank"} rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-caption text-ink-tertiary hover:text-accent">
                {alert.source.label}
                <Icon name="external" size={11} />
              </a>
            </Moment>
          ))}
          <Moment at={OUTCOME.at} dot="bg-match" label="What happened" live={replay.done}>
            <p className="font-medium">{OUTCOME.text}</p>
          </Moment>
        </ol>

        <footer className="mt-5 flex items-center gap-3 border-t border-hairline-faint pt-4">
          <p className="min-w-0 grow text-caption text-ink-tertiary">{replay.device ? DEVICE_NOTE[replay.device] : "Alerts arrive a few seconds apart."}</p>
          {replay.done ? (
            <button type="button" onClick={playReplay} className="h-8 shrink-0 rounded-md border border-hairline-strong px-3 text-small text-ink-secondary hover:bg-active hover:text-ink">
              Play again
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
