import { useSyncExternalStore } from 'react'
import { getCatalog, subscribeCatalog } from './catalogChoice'

export function useCatalogChoice() {
  return useSyncExternalStore(subscribeCatalog, getCatalog)
}
