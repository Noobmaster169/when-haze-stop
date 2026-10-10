"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A number that glides to its new value instead of jumping, so a reading
 * counts up or down as the timeline is scrubbed. Whole numbers only.
 */

const GLIDE_MS = 280;

export function useTween(target: number): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = target;
      const frame = requestAnimationFrame(() => setShown(target));
      return () => cancelAnimationFrame(frame);
    }
    const began = performance.now();
    let frame = requestAnimationFrame(function tick(time) {
      const share = Math.min(1, (time - began) / GLIDE_MS);
      const eased = 1 - (1 - share) ** 3;
      const value = Math.round(start + (target - start) * eased);
      from.current = value;
      setShown(value);
      if (share < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return shown;
}
