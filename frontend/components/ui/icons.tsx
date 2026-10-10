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
  panel: "M2.5 3 h11 v10 h-11 z M6.5 3 v10",
  plus: "M8 3 v10 M3 8 h10",
  close: "M4 4 L12 12 M12 4 L4 12",
  send: "M8 12.5 V3.5 M4.5 7 L8 3.5 L11.5 7",
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
