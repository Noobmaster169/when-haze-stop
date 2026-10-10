import type { ModelClient, ModelForecast, ModelHealth } from "../model";

/** Answers every ask with the forecasts it was handed, and remembers each ask. No test may reach the model service. */
export class FakeModelClient implements ModelClient {
  readonly asked: Date[] = [];

  constructor(
    private readonly forecasts: ModelForecast[],
    private readonly version: string | null = forecasts[0]?.modelVersion ?? null,
  ) {}

  async health(): Promise<ModelHealth> {
    return { modelVersion: this.version, trainedAt: this.version ? new Date("2026-10-11T02:00:00Z") : null };
  }

  async predict(asOf: Date): Promise<ModelForecast[]> {
    this.asked.push(asOf);
    return this.forecasts;
  }
}
