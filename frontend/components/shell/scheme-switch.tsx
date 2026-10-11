"use client";

import { useEffect } from "react";

import { Icon } from "@/components/ui/icons";
import { choose, followSystem, useScheme } from "@/lib/colour-scheme";

/**
 * Light or dark, one tap. Tapping to the scheme the system already uses
 * forgets the choice, so the app follows the system again without a third
 * option to explain.
 */
export function SchemeSwitch() {
  const scheme = useScheme();
  useEffect(followSystem, []);
  if (!scheme) return null;
  const next = scheme === "dark" ? "light" : "dark";
  const flip = (): void => {
    const system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    choose(next === system ? "system" : next);
  };
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-ink-inverse shadow-overlay transition-transform duration-300 ease-island hover:scale-[1.05] focus-visible:rounded-full!"
    >
      <Icon name={scheme === "dark" ? "sun" : "moon"} size={16} />
    </button>
  );
}
