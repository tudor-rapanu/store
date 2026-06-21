export function readEnvValue(value: string | undefined, name: string) {
  const cleaned = value?.trim().replace(/^["']|["']$/g, "");

  if (!cleaned) {
    throw new Error(`${name} is not set.`);
  }

  return cleaned;
}
