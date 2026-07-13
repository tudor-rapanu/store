"use client";

type CachedJsonEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

const jsonCache = new Map<string, CachedJsonEntry<unknown>>();

type FetchCachedJsonOptions = RequestInit & {
  ttlMs: number;
};

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data;
}

export function fetchCachedJson<T>(
  key: string,
  url: string | URL,
  { ttlMs, ...init }: FetchCachedJsonOptions,
): Promise<T> {
  const now = Date.now();
  const existing = jsonCache.get(key) as CachedJsonEntry<T> | undefined;

  if (existing && existing.expiresAt > now) {
    return existing.promise;
  }

  const promise = fetch(url, init)
    .then((response) => parseJsonResponse<T>(response))
    .catch((error) => {
      jsonCache.delete(key);
      throw error;
    });

  jsonCache.set(key, {
    expiresAt: now + ttlMs,
    promise,
  });

  return promise;
}

export function clearCachedJson(keyPrefix: string) {
  for (const key of jsonCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      jsonCache.delete(key);
    }
  }
}
