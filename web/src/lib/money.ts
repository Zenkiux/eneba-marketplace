const formatters = new Map<string, Intl.NumberFormat>()

function formatterFor(currency: string): Intl.NumberFormat {
  let formatter = formatters.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-IE', { style: 'currency', currency })
    formatters.set(currency, formatter)
  }
  return formatter
}

/** Formats an integer amount of minor units (cents), e.g. 1234 → "€12.34". */
export function formatCents(cents: number, currency = 'EUR'): string {
  if (!Number.isInteger(cents)) throw new RangeError(`cents must be an integer, got ${cents}`)
  return formatterFor(currency).format(cents / 100)
}
