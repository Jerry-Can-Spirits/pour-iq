// Single source of truth for every Pour IQ price. No price literal may
// appear in JSX — pages render these constants (and the derived figures
// computed below) only, so a price change is a one-line edit here.

export const pricing = {
  currency: 'GBP',
  vat: '+VAT',
  /** Per venue, per month. */
  monthly: 99,
  /** Per venue, per year — two months free against twelve at `monthly`. */
  annual: 990,
  /** Per venue, per month, first `foundingCap` venues, locked while subscribed. */
  founding: 79,
  foundingCap: 10,
} as const

/** Twelve months at the monthly rate — the annual cost quoted against the leak. */
export const annualAtMonthlyRate = pricing.monthly * 12

/** Twelve months at the founding rate. */
export const foundingAnnualRate = pricing.founding * 12

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: pricing.currency,
  maximumFractionDigits: 0,
})

/** True pound sign, comma-grouped, no pence: 1188 → "£1,188". */
export function formatPrice(amount: number): string {
  return gbp.format(amount)
}
