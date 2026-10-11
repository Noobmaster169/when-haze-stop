"use client";

import { type RefObject, useEffect } from "react";

import { panBy, type Size, type View, zoomAt } from "./geo";

/**
 * Drag to move, wheel or pinch to zoom, arrow keys and plus and minus for the
 * keyboard, and a tap that did not move is a pick.
 */

export interface GestureTarget {
  view: View;
  size: Size;
}

const TAP_SLACK_PX = 5;
const KEY_PAN_PX = 60;

export function useGestures(
  canvas: RefObject<HTMLCanvasElement | null>,
  target: RefObject<GestureTarget>,
  onMove: () => void,
  onTap: (x: number, y: number) => void,
): void {
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const pointers = new Map<number, [number, number]>();
    let moved = 0;
    let pinch = 0;

    const apply = (view: View): void => {
      target.current.view = view;
      onMove();
    };
    const spread = (): number => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a[0] - b[0], a[1] - b[1]);
    };

    const down = (event: PointerEvent): void => {
      element.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, [event.offsetX, event.offsetY]);
      moved = 0;
      if (pointers.size === 2) pinch = spread();
    };
    const move = (event: PointerEvent): void => {
      const last = pointers.get(event.pointerId);
      if (!last) return;
      const dx = event.offsetX - last[0];
      const dy = event.offsetY - last[1];
      pointers.set(event.pointerId, [event.offsetX, event.offsetY]);
      const { view, size } = target.current;
      if (pointers.size === 1) {
        moved += Math.abs(dx) + Math.abs(dy);
        apply(panBy(view, size, dx, dy));
      } else if (pointers.size === 2 && pinch > 0) {
        const [a, b] = [...pointers.values()];
        const now = spread();
        apply(zoomAt(view, size, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, now / pinch));
        pinch = now;
        moved += TAP_SLACK_PX;
      }
    };
    const up = (event: PointerEvent): void => {
      if (!pointers.delete(event.pointerId)) return;
      if (pointers.size === 0 && moved < TAP_SLACK_PX) onTap(event.offsetX, event.offsetY);
    };
    const cancel = (event: PointerEvent): void => {
      pointers.delete(event.pointerId);
    };
    const wheel = (event: WheelEvent): void => {
      event.preventDefault();
      const { view, size } = target.current;
      apply(zoomAt(view, size, event.offsetX, event.offsetY, Math.exp(-event.deltaY * 0.0015)));
    };
    const key = (event: KeyboardEvent): void => {
      const { view, size } = target.current;
      const centre: [number, number] = [size.width / 2, size.height / 2];
      if (event.key === "+" || event.key === "=") apply(zoomAt(view, size, ...centre, 1.3));
      else if (event.key === "-") apply(zoomAt(view, size, ...centre, 1 / 1.3));
      else if (event.key === "ArrowLeft") apply(panBy(view, size, KEY_PAN_PX, 0));
      else if (event.key === "ArrowRight") apply(panBy(view, size, -KEY_PAN_PX, 0));
      else if (event.key === "ArrowUp") apply(panBy(view, size, 0, KEY_PAN_PX));
      else if (event.key === "ArrowDown") apply(panBy(view, size, 0, -KEY_PAN_PX));
      else return;
      event.preventDefault();
    };

    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", cancel);
    element.addEventListener("wheel", wheel, { passive: false });
    element.addEventListener("keydown", key);
    return () => {
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", cancel);
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("keydown", key);
    };
  }, [canvas, target, onMove, onTap]);
}
