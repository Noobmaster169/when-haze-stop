"use client";

import { Icon } from "@/components/ui/icons";

import type { Layers } from "./map-canvas";
import { STOP_VALUES } from "./scale";

/** What sits on the map's corners: the layers, the zoom buttons and the key to the colours. */

const CARD = "rounded-lg border border-hairline bg-canvas shadow-overlay";

const LAYERS: { key: keyof Layers; label: string }[] = [
  { key: "haze", label: "Haze" },
  { key: "stations", label: "Stations" },
  { key: "fires", label: "Fires" },
  { key: "wind", label: "Wind" },
];

export function LayerToggles({ layers, onChange }: { layers: Layers; onChange(layers: Layers): void }) {
  return (
    <div className={`${CARD} flex gap-0.5 p-1`} role="group" aria-label="Map layers">
      {LAYERS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          aria-pressed={layers[key]}
          onClick={() => onChange({ ...layers, [key]: !layers[key] })}
          className={`h-7 rounded-sm px-2.5 text-small transition-colors duration-150 ${layers[key] ? "bg-ink font-medium text-ink-inverse" : "text-ink-tertiary hover:bg-active hover:text-ink"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function ZoomButtons({ onZoom }: { onZoom(factor: number): void }) {
  const button = "flex h-8 w-8 items-center justify-center text-ink-secondary hover:bg-active hover:text-ink";
  return (
    <div className={`${CARD} flex flex-col overflow-hidden`}>
      <button type="button" aria-label="Zoom in" onClick={() => onZoom(1.5)} className={button}>
        <Icon name="plus" size={14} />
      </button>
      <span className="h-px bg-hairline" />
      <button type="button" aria-label="Zoom out" onClick={() => onZoom(1 / 1.5)} className={button}>
        <Icon name="minus" size={14} />
      </button>
    </div>
  );
}

const RAMP = "linear-gradient(to right, var(--api-0), var(--api-50), var(--api-100), var(--api-150), var(--api-200), var(--api-300))";
const TICKS = STOP_VALUES.filter((value) => value <= 300);

/** The ramp is drawn evenly between its stops, so 300 is at the right edge and 200 is not at two thirds. */
export function Legend() {
  return (
    <div className={`${CARD} w-[224px] px-3 pb-2 pt-2.5`}>
      <p className="text-caption font-medium text-ink-secondary">Air Pollutant Index (API)</p>
      <div aria-hidden="true" className="mt-1.5 h-2 rounded-full" style={{ background: RAMP }} />
      <div className="mt-1 flex justify-between font-mono text-mono-xs text-ink-tertiary">
        {TICKS.map((value) => (
          <span key={value}>{value}</span>
        ))}
      </div>
      <p className="mt-1.5 text-micro text-ink-tertiary">Above 100 is unhealthy. Schools close above 180.</p>
    </div>
  );
}
