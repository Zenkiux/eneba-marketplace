// Store filters live in the URL (shareable, back/forward works). These pure helpers convert
// between the browser's query string and the API's query string.

export interface StoreState {
  works: boolean // "Works for me" (uses the saved device profile)
  q: string
  platform: string[]
  region: string[]
  type: string[]
  genre: string[]
  os: string[] // windows | mac | linux ("Operating system" filter)
  country: string // ISO code: keys that activate there ("Country" filter); '' = all countries
  minPrice: number | null // cents
  maxPrice: number | null // cents
  sort: string
  page: number
}

export const SORTS = [
  { value: 'popular', label: 'Popularity: Most popular' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Date: Newest First' },
  { value: 'oldest', label: 'Date: Oldest First' },
  { value: 'alpha_asc', label: 'Alphabet: A-Z' },
  { value: 'alpha_desc', label: 'Alphabet: Z-A' },
  { value: 'discount', label: 'Discounts' },
] as const

export const RELEVANCE = { value: 'relevance', label: 'Best match' } as const

export const PAGE_SIZE = 24

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : [])

function cents(v: string | null): number | null {
  if (!v || !/^\d+$/.test(v)) return null
  return Number(v)
}

export function parseStoreParams(params: URLSearchParams): StoreState {
  const q = (params.get('q') ?? '').trim()
  const page = Number(params.get('page'))
  return {
    works: params.get('works') === '1',
    q,
    platform: list(params.get('platform')),
    region: list(params.get('region')),
    type: list(params.get('type')),
    genre: list(params.get('genre')),
    os: list(params.get('os_filter')),
    country: /^[A-Z]{2}$/.test(params.get('country') ?? '') ? params.get('country')! : '',
    minPrice: cents(params.get('min_price')),
    maxPrice: cents(params.get('max_price')),
    sort: params.get('sort') ?? (q ? RELEVANCE.value : 'popular'),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

/** Query string for the browser URL: only non-default values, in a stable order. */
export function toUrlParams(s: StoreState): URLSearchParams {
  const p = new URLSearchParams()
  if (s.q) p.set('q', s.q)
  if (s.platform.length) p.set('platform', s.platform.join(','))
  if (s.region.length) p.set('region', s.region.join(','))
  if (s.type.length) p.set('type', s.type.join(','))
  if (s.genre.length) p.set('genre', s.genre.join(','))
  if (s.os.length) p.set('os_filter', s.os.join(','))
  if (s.country) p.set('country', s.country)
  if (s.minPrice !== null) p.set('min_price', String(s.minPrice))
  if (s.maxPrice !== null) p.set('max_price', String(s.maxPrice))
  const defaultSort = s.q ? RELEVANCE.value : 'popular'
  if (s.sort !== defaultSort) p.set('sort', s.sort)
  if (s.page > 1) p.set('page', String(s.page))
  if (s.works) p.set('works', '1')
  return p
}

/** Query string for GET /api/products. `works` adds the visitor's device profile. */
export function toApiQuery(s: StoreState, works?: URLSearchParams | null): string {
  const p = toUrlParams(s)
  p.delete('works')
  p.set('sort', s.sort)
  p.set('page_size', String(PAGE_SIZE))
  if (s.q && s.page === 1) p.set('log', '1') // counts towards "Trending searches"
  if (s.works && works) works.forEach((v, k) => p.set(k, v))
  return p.toString()
}

/** Toggle one value in a multi-select filter; any filter change goes back to page 1. */
export function toggle(s: StoreState, key: 'platform' | 'region' | 'type' | 'genre' | 'os', value: string): StoreState {
  const has = s[key].includes(value)
  return { ...s, [key]: has ? s[key].filter((v) => v !== value) : [...s[key], value], page: 1 }
}

/** "12.50" → 1250; empty → null; invalid → undefined (leave unchanged). */
export function eurosToCents(text: string): number | null | undefined {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return undefined
  return Math.round(Number(t) * 100)
}
