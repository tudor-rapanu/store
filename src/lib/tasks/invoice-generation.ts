import { createJsonCloudTask } from "@/lib/tasks/cloud-tasks";

export type InvoiceGenerationTaskPayload = {
  orderId: string;
};

type FallbackRunner = () => Promise<unknown> | unknown;

export function enqueueInvoiceGenerationTask(
  payload: InvoiceGenerationTaskPayload,
  fallback: FallbackRunner,
) {
  return createJsonCloudTask("invoice", "/api/tasks/generate-invoice", payload)
    .then((queued) => {
      if (!queued) {
        return fallback();
      }

      return undefined;
    })
    .catch((error) => {
      console.error(
        "Invoice generation task enqueue failed. Falling back inline.",
        error,
      );
      return fallback();
    });
}
