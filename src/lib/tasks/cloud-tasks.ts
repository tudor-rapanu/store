import { getTaskSecret } from "@/lib/tasks/auth";

export type CloudTaskQueue = "email" | "invoice" | "awb" | "default";

type CloudTasksConfig = {
  queuePath: string;
  siteUrl: string;
  secret: string;
};

const QUEUE_ENV_PREFIXES: Record<CloudTaskQueue, string | null> = {
  email: "EMAIL",
  invoice: "INVOICE",
  awb: "AWB",
  default: null,
};

function getSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

  if (!value) {
    return undefined;
  }

  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function getProjectId() {
  return (
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    process.env.GCP_PROJECT?.trim()
  );
}

function getQueueEnvValue(queue: CloudTaskQueue, suffix: "QUEUE_PATH" | "QUEUE") {
  const prefix = QUEUE_ENV_PREFIXES[queue];

  if (!prefix) {
    return undefined;
  }

  return process.env[`CLOUD_TASKS_${prefix}_${suffix}`]?.trim();
}

function getQueuePath(queue: CloudTaskQueue) {
  const queuePath =
    getQueueEnvValue(queue, "QUEUE_PATH") ||
    process.env.CLOUD_TASKS_QUEUE_PATH?.trim();

  if (queuePath) {
    return queuePath;
  }

  const projectId = getProjectId();
  const location = process.env.CLOUD_TASKS_LOCATION?.trim() || "europe-west1";
  const queueName =
    getQueueEnvValue(queue, "QUEUE") || process.env.CLOUD_TASKS_QUEUE?.trim();

  if (!projectId || !queueName) {
    return undefined;
  }

  return `projects/${projectId}/locations/${location}/queues/${queueName}`;
}

function getCloudTasksConfig(queue: CloudTaskQueue): CloudTasksConfig | null {
  const queuePath = getQueuePath(queue);
  const siteUrl = getSiteUrl();
  const secret = getTaskSecret();

  return queuePath && siteUrl && secret ? { queuePath, siteUrl, secret } : null;
}

async function getGoogleAccessToken() {
  const response = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    {
      headers: {
        "Metadata-Flavor": "Google",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Could not get Google metadata access token.");
  }

  const data = (await response.json()) as { access_token?: string };

  if (!data.access_token) {
    throw new Error("Google metadata access token was missing.");
  }

  return data.access_token;
}

export async function createJsonCloudTask(
  queue: CloudTaskQueue,
  path: string,
  payload: unknown,
) {
  const config = getCloudTasksConfig(queue);

  if (!config) {
    return false;
  }

  const accessToken = await getGoogleAccessToken();
  const taskUrl = `${config.siteUrl}${path}`;
  const response = await fetch(
    `https://cloudtasks.googleapis.com/v2/${config.queuePath}/tasks`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task: {
          httpRequest: {
            httpMethod: "POST",
            url: taskUrl,
            headers: {
              Authorization: `Bearer ${config.secret}`,
              "Content-Type": "application/json",
            },
            body: Buffer.from(JSON.stringify(payload)).toString("base64"),
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Cloud Tasks enqueue failed: ${response.status} ${message}`);
  }

  return true;
}
