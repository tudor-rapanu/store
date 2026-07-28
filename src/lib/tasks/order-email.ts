import { createJsonCloudTask } from "@/lib/tasks/cloud-tasks";

export type OrderEmailTaskPayload = {
  orderId: string;
  type: "admin" | "customer" | "tracking" | "invoice";
  locale?: "en" | "ro";
};

type FallbackSender = () => Promise<unknown> | unknown;

export function enqueueOrderEmailTask(
  payload: OrderEmailTaskPayload,
  fallback: FallbackSender,
) {
  return createJsonCloudTask("email", "/api/tasks/send-order-email", payload)
    .then((queued) => {
      if (!queued) {
        return fallback();
      }

      return undefined;
    })
    .catch((error) => {
      console.error("Order email task enqueue failed. Falling back inline.", error);
      return fallback();
    });
}
