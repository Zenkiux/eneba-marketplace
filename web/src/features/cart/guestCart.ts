// Cart for visitors who are not signed in, kept in localStorage. Only offer ids and quantities
// are stored: prices, stock and names are always re-read from the API, so a stale browser can
// never decide what something costs. On sign-in these lines are merged into the server cart.

export interface CartLineRef {
  offerId: number
  quantity: number
}

export const MAX_QUANTITY = 10
const KEY = 'keyshop.cart.v1'

type Listener = () => void
const listeners = new Set<Listener>()
let cache: CartLineRef[] | null = null

function read(): CartLineRef[] {
  if (cache) return cache
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    cache = Array.isArray(raw)
      ? raw
          .filter((l): l is CartLineRef => Number.isInteger(l?.offerId) && Number.isInteger(l?.quantity))
          .map((l) => ({ offerId: l.offerId, quantity: Math.min(Math.max(l.quantity, 1), MAX_QUANTITY) }))
      : []
  } catch {
    cache = []
  }
  return cache
}

function write(lines: CartLineRef[]) {
  cache = lines
  try {
    localStorage.setItem(KEY, JSON.stringify(lines))
  } catch {
    // Storage full or blocked (private mode): the cart still works for this page view.
  }
  listeners.forEach((l) => l())
}

export const guestCart = {
  subscribe(fn: Listener) {
    listeners.add(fn)
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        cache = null
        fn()
      }
    }
    window.addEventListener('storage', onStorage) // keep tabs in sync
    return () => {
      listeners.delete(fn)
      window.removeEventListener('storage', onStorage)
    }
  },
  get: read,
  /** Adds quantity to a line, capped at the stock seen on the page and MAX_QUANTITY. */
  add(offerId: number, quantity: number, maxStock = MAX_QUANTITY) {
    const lines = read()
    const cap = Math.min(MAX_QUANTITY, Math.max(maxStock, 1))
    const existing = lines.find((l) => l.offerId === offerId)
    const next = existing
      ? lines.map((l) => (l.offerId === offerId ? { ...l, quantity: Math.min(l.quantity + quantity, cap) } : l))
      : [...lines, { offerId, quantity: Math.min(quantity, cap) }]
    write(next)
  },
  set(offerId: number, quantity: number) {
    write(read().map((l) => (l.offerId === offerId ? { ...l, quantity: Math.min(Math.max(quantity, 1), MAX_QUANTITY) } : l)))
  },
  remove(offerId: number) {
    write(read().filter((l) => l.offerId !== offerId))
  },
  clear() {
    write([])
  },
}
