import type { SVGProps } from "react";

/*
 * Everything is a 16px viewBox at a 1.4 stroke, which is also lucide's grid:
 * add lucide-react for an icon this file does not carry and it sits beside
 * these without a seam.
 */
const PATHS = {
  home: "M2.5 7 L8 2.5 L13.5 7 V13.5 h-11 z",
  clock: "M8 2.5 a5.5 5.5 0 1 0 0 11 a5.5 5.5 0 0 0 0 -11 M8 5 v3.2 l2.2 1.4",
  chat: "M2.5 3.5 h11 v7 h-6.5 L4 13 v-2.5 h-1.5 z",
  plus: "M8 3 v10 M3 8 h10",
  close: "M4 4 L12 12 M12 4 L4 12",
  send: "M8 12.5 V3.5 M4.5 7 L8 3.5 L11.5 7",
  map: "M2.5 4 l3.5 -1.5 l4 1.5 l3.5 -1.5 v9.5 l-3.5 1.5 l-4 -1.5 l-3.5 1.5 z M6 2.5 v9.5 M10 4 v9.5",
  bell: "M4 11.5 V7.5 a4 4 0 0 1 8 0 v4 l1 1.5 h-10 z M6.8 13.2 a1.3 1.3 0 0 0 2.4 0",
  chart: "M2.5 13.5 h11 M4.5 11 V8 M8 11 V4 M11.5 11 V6.5",
  pin: "M8 14 c0 0 -4.5 -4.1 -4.5 -7.5 a4.5 4.5 0 0 1 9 0 c0 3.4 -4.5 7.5 -4.5 7.5 z M8 5 a1.5 1.5 0 1 0 0 3 a1.5 1.5 0 0 0 0 -3",
  flame: "M8 14 c-2.6 0 -4.5 -1.8 -4.5 -4.2 c0 -2.6 2.2 -3.6 2.5 -7.3 c1.6 1 2.6 2.6 2.6 4.2 c0.7 -0.5 1.1 -1.3 1.2 -2.2 c1.6 1.2 2.7 3.1 2.7 5.3 c0 2.4 -1.9 4.2 -4.5 4.2 z",
  wind: "M2.5 6 h7.2 a1.9 1.9 0 1 0 -1.9 -1.9 M2.5 9 h9.4 a1.9 1.9 0 1 1 -1.9 1.9 M2.5 12 h4",
  grid: "M2.5 2.5 h11 v11 h-11 z M2.5 6.2 h11 M2.5 9.8 h11 M6.2 2.5 v11 M9.8 2.5 v11",
  sun: "M8 5.5 a2.5 2.5 0 1 0 0 5 a2.5 2.5 0 0 0 0 -5 M8 1.8 v1.4 M8 12.8 v1.4 M1.8 8 h1.4 M12.8 8 h1.4 M3.6 3.6 l1 1 M11.4 11.4 l1 1 M3.6 12.4 l1 -1 M11.4 4.6 l1 -1",
  wave: "M1.8 6.5 c1.5 -1.4 2.6 -1.4 4.1 0 s2.6 1.4 4.1 0 s2.6 -1.4 4.1 0 M1.8 10.5 c1.5 -1.4 2.6 -1.4 4.1 0 s2.6 1.4 4.1 0 s2.6 -1.4 4.1 0",
  calendar: "M2.5 3.5 h11 v10 h-11 z M2.5 6.5 h11 M5.5 2 v3 M10.5 2 v3",
  check: "M3.5 8.5 l3 3 l6 -7",
  alert: "M8 2.5 L14 13 H2 z M8 6.5 v3 M8 11.2 v0.3",
  external: "M9 2.5 h4.5 v4.5 M13.5 2.5 L7.5 8.5 M11.5 9.5 v4 h-9 v-9 h4",
  left: "M10 3.5 L5.5 8 L10 12.5",
  right: "M6 3.5 L10.5 8 L6 12.5",
  database: "M3 4 a5 1.8 0 1 0 10 0 a5 1.8 0 1 0 -10 0 V12 a5 1.8 0 0 0 10 0 V4 M3 8 a5 1.8 0 0 0 10 0",
  search: "M7 2.5 a4.5 4.5 0 1 0 0 9 a4.5 4.5 0 0 0 0 -9 M10.3 10.3 L13.5 13.5",
  play: "M5 3 v10 l8 -5 z",
  pause: "M5 3 v10 M11 3 v10",
  minus: "M3 8 h10",
  trash: "M2.5 4.5 h11 M6 4.5 V3 h4 v1.5 M4 4.5 l0.7 9 h6.6 l0.7 -9 M6.6 7 v4 M9.4 7 v4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 15, ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
