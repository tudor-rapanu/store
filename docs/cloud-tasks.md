# Cloud Tasks

The app can enqueue background work into separate Cloud Tasks queues so one slow
provider does not block unrelated jobs.

## Queues

Recommended queues:

| Queue | Endpoint | Suggested purpose |
| --- | --- | --- |
| `order-emails` | `/api/tasks/send-order-email` | customer, admin, invoice, and tracking emails |
| `order-invoices` | `/api/tasks/generate-invoice` | FGO invoice generation |
| `order-awb` | `/api/tasks/generate-awb` | Sameday AWB generation |

## Environment

The shared values are still required:

```bash
NEXT_PUBLIC_SITE_URL=https://example.com
CLOUD_TASKS_LOCATION=europe-west6
CLOUD_TASKS_SECRET=...
```

Use either full queue paths:

```bash
CLOUD_TASKS_EMAIL_QUEUE_PATH=projects/PROJECT_ID/locations/europe-west6/queues/order-emails
CLOUD_TASKS_INVOICE_QUEUE_PATH=projects/PROJECT_ID/locations/europe-west6/queues/order-invoices
CLOUD_TASKS_AWB_QUEUE_PATH=projects/PROJECT_ID/locations/europe-west6/queues/order-awb
```

Or queue names with the shared project/location:

```bash
CLOUD_TASKS_EMAIL_QUEUE=order-emails
CLOUD_TASKS_INVOICE_QUEUE=order-invoices
CLOUD_TASKS_AWB_QUEUE=order-awb
```

Fallback values are still supported:

```bash
CLOUD_TASKS_QUEUE_PATH=projects/PROJECT_ID/locations/europe-west6/queues/default
# or
CLOUD_TASKS_QUEUE=default
```

If a specific queue env var is missing, that job type falls back to the shared
queue.

## Suggested Rate Limits

- Emails: higher throughput is fine, for example 10-20 dispatches/second.
- FGO invoices: keep conservative, for example 1 dispatch/second.
- Sameday AWB: keep moderate, for example 1-3 dispatches/second.

For permanent provider/business errors, task endpoints should return `2xx` and
mark the order status as failed in the database. Return `5xx` only for retryable
network/provider outages.
