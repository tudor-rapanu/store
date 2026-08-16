export function parseEnabledFlag(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function isWooCommerceMigrationEnabled() {
  return parseEnabledFlag(process.env.ENABLE_WOOCOMMERCE_IMPORT);
}
