import type { IconName } from "@/components/ui/icons";

/** The rail's destinations, and the one place they are named. A new page is a line here. */
export interface Destination {
  key: string;
  label: string;
  href: string;
  icon: IconName;
}

export const DESTINATIONS: Destination[] = [{ key: "home", label: "Home", href: "/", icon: "home" }];

/** The destination a pathname sits under: the longest href that prefixes it. */
export function activeFor(pathname: string): string | null {
  const matches = DESTINATIONS.filter((item) => (item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`)));
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.key ?? null;
}
