// Visitor's language and display currency (like Eneba's "English EU | EUR" selector).
// Stored per browser. Prices are always charged in EUR; other currencies are display only.

export const LANGUAGES = [
  { code: 'en', label: 'English', short: 'English EU', htmlLang: 'en', intl: 'en-IE' },
  { code: 'lt', label: 'Lietuvių', short: 'Lietuvių', htmlLang: 'lt', intl: 'lt-LT' },
  { code: 'de', label: 'Deutsch', short: 'Deutsch', htmlLang: 'de', intl: 'de-DE' },
  { code: 'pl', label: 'Polski', short: 'Polski', htmlLang: 'pl', intl: 'pl-PL' },
] as const

export type Lang = (typeof LANGUAGES)[number]['code']
export const CURRENCY_CODES = ['EUR', 'USD', 'GBP', 'PLN', 'SEK', 'CZK'] as const
export type CurrencyCode = (typeof CURRENCY_CODES)[number]

export interface Locale {
  lang: Lang
  currency: CurrencyCode
}

const KEY = 'keyshop.locale.v1'
const listeners = new Set<() => void>()
let cache: Locale | undefined

function guessLang(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : 'en'
  return (LANGUAGES.find((l) => l.code === nav)?.code ?? 'en') as Lang
}

export function getLocale(): Locale {
  if (cache) return cache
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Locale> | null
    cache = {
      lang: LANGUAGES.some((l) => l.code === raw?.lang) ? (raw!.lang as Lang) : guessLang(),
      currency: CURRENCY_CODES.includes(raw?.currency as CurrencyCode) ? (raw!.currency as CurrencyCode) : 'EUR',
    }
  } catch {
    cache = { lang: 'en', currency: 'EUR' }
  }
  return cache
}

export function setLocale(next: Locale) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage blocked
  }
  document.documentElement.lang = LANGUAGES.find((l) => l.code === next.lang)?.htmlLang ?? 'en'
  listeners.forEach((l) => l())
}

export function subscribeLocale(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
