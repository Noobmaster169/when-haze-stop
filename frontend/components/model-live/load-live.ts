import { unstable_rethrow } from "next/navigation";

import { getModelLive } from "@/lib/api-client";
import type { ModelLive } from "@/lib/api/model-schemas";

/**
 * The live record for the Model page, read on the server on each visit. Null
 * when the backend cannot be read, so the page's other chapters still show.
 * `follow` is the browser's followed stations, when the page knows them.
 */
export async function loadModelLive(follow: string[] = []): Promise<ModelLive | null> {
  try {
    return await getModelLive(follow);
  } catch (error) {
    // Next signals "render this per request" by throwing; that is not a backend failure.
    unstable_rethrow(error);
    console.error("[model] the live record could not be read:", error);
    return null;
  }
}
