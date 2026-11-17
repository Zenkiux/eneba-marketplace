import { useQuery } from '@tanstack/react-query'
import { useCallback, useSyncExternalStore } from 'react'
import { api } from '../api/client'
import { DICTS } from './dict'
import { getLocale, LANGUAGES, subscribeLocale, type CurrencyCode } from './locale'

interface CurrencyInfo {
  code: CurrencyCode
  symbol: string
  rate: number
}

export function useLocale() {
  return useSyncExternalStore(subscribeLocale, getLocale)
}

export function useCurrencies() {
  return useQuery({
    queryKey: ['currencies'],
    queryFn: ({ signal }) => api.get<{ base: string; currencies: CurrencyInfo[] }>('/currencies', { signal }),
    staleTime: 60 * 60_000,
  })
}

/** Translate English source text; `{name}` placeholders are filled from `vars`. */
export function translate(lang: string, text: string, vars?: Record<string, string | number>): string {
  let out = DICTS[lang as keyof typeof DICTS]?.[text] ?? text
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v))
  return out
}

/**
 * t() for UI text and money() for prices. Prices are stored in EUR cents; money() converts to
 * the visitor's display currency with the API's fixed demo rates (EUR until they load).
 */
export function useI18n() {
  const locale = useLocale()
  const { data } = useCurrencies()
  const intl = LANGUAGES.find((l) => l.code === locale.lang)?.intl ?? 'en-IE'
  const t = useCallback((text: string, vars?: Record<string, string | number>) => translate(locale.lang, text, vars), [locale.lang])
  const money = useCallback(
    (eurCents: number) => {
      const cur = data?.currencies.find((c) => c.code === locale.currency)
      const code = cur ? cur.code : 'EUR'
      const value = (eurCents / 100) * (cur ? cur.rate : 1)
      return new Intl.NumberFormat(intl, { style: 'currency', currency: code }).format(value)
    },
    [data, locale.currency, intl],
  )
  /** Always EUR (what is actually charged). */
  const eur = useCallback((eurCents: number) => new Intl.NumberFormat(intl, { style: 'currency', currency: 'EUR' }).format(eurCents / 100), [intl])
  return { t, money, eur, intl, lang: locale.lang, currency: locale.currency, converted: locale.currency !== 'EUR' && !!data }
}
