import type { IconName } from "@/components/ui/icons";

/** The island's destinations, and the one place they are named. A new page is a line here. */
export interface Destination {
  key: string;
  label: string;
  href: string;
  icon: IconName;
}

export const DESTINATIONS: Destination[] = [
  { key: "map", label: "Map", href: "/map", icon: "map" },
  { key: "city", label: "KL in 3D", href: "/city", icon: "city" },
  { key: "alerts", label: "Alerts", href: "/alerts", icon: "bell" },
  { key: "simulation", label: "Simulation", href: "/simulation", icon: "chart" },
  { key: "sources", label: "Sources", href: "/sources", icon: "database" },
];

/** The destination a pathname sits under: the longest href that prefixes it. */
export function activeFor(pathname: string): string | null {
  const matches = DESTINATIONS.filter((item) => (item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`)));
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.key ?? null;
}
