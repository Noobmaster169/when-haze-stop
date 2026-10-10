import { permanentRedirect } from "next/navigation";

/** The Track record became the Simulation page; old links land there. */
export default function AccuracyPage() {
  permanentRedirect("/simulation");
}
