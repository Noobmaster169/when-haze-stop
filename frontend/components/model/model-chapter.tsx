import type { ReactNode } from "react";

import { Chapter } from "@/components/simulation/chapter";

import { MODEL_CHAPTERS } from "./chapters";

/** The Simulation page's numbered chapter, read from the Model page's own list. */
export function ModelChapter({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Chapter id={id} chapters={MODEL_CHAPTERS}>
      {children}
    </Chapter>
  );
}
