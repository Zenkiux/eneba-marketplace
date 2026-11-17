// Which catalog the visitor chose: our original demo catalog (default) or the optional snapshot
// of eneba.com listings. Stored per browser; sent to the API as the X-Catalog header.

export type CatalogChoice = 'demo' | 'eneba'
const KEY = 'keyshop.catalog'
type Listener = () => void
const listeners = new Set<Listener>()

export function getCatalog(): CatalogChoice {
  try {
    return localStorage.getItem(KEY) === 'eneba' ? 'eneba' : 'demo'
  } catch {
    return 'demo'
  }
}

export function setCatalog(c: CatalogChoice) {
  try {
    localStorage.setItem(KEY, c)
  } catch {
    // storage blocked: the choice lasts for this page view only
  }
  listeners.forEach((l) => l())
}

export function subscribeCatalog(fn: Listener) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
