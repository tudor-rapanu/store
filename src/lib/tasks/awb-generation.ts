import type { GenerateAwbBody } from "@/lib/orders/generate-awb";
import { createJsonCloudTask } from "@/lib/tasks/cloud-tasks";

export type AwbGenerationTaskPayload = {
  orderId: string;
  body: GenerateAwbBody;
};

type FallbackRunner = () => Promise<unknown> | unknown;

export function enqueueAwbGenerationTask(
  payload: AwbGenerationTaskPayload,
  fallback: FallbackRunner,
) {
  return createJsonCloudTask("awb", "/api/tasks/generate-awb", payload)
    .then((queued) => {
      if (!queued) {
        return fallback();
      }

      return undefined;
    })
    .catch((error) => {
      console.error("AWB generation task enqueue failed. Falling back inline.", error);
      return fallback();
    });
}
