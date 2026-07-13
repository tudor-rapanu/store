export function formatRon(amountBani: number) {
  return `${(amountBani / 100).toFixed(2)} RON`;
}

export function formatEur(amountBani: number, ronToEurRate: number) {
  return `${((amountBani / 100) * ronToEurRate).toFixed(2)} EUR`;
}

export function convertRonBaniToEurCents(amountBani: number, ronToEurRate: number) {
  return Math.round((amountBani / 100) * ronToEurRate * 100);
}

export function normalizePaymentCurrency(value: unknown) {
  return value === "EUR" ? "EUR" : "RON";
}
