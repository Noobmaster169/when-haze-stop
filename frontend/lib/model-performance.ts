import raw from "./data/model-performance.json";
import { ModelPerformanceSchema, type ModelPerformance } from "./model-performance-schema";

/** The published scores, parsed once at build time so the page never renders a field the file lacks. */
export const MODEL_PERFORMANCE: ModelPerformance = ModelPerformanceSchema.parse(raw);
