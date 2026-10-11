import { Simulation } from "./simulation-schemas";
import { get } from "./transport";

/** The backend replays every stored hour on each request, which takes a moment as the history grows. */
const SIMULATION_TIMEOUT_MS = 30_000;

export async function getSimulation(): Promise<Simulation> {
  return get(Simulation, "/haze/simulation", { timeoutMs: SIMULATION_TIMEOUT_MS });
}
