import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from './client'
import type { HomeSection, HomeSectionRef, ProductCard, ProductDetail, ProductPage } from './types'

export function useProducts(query: string, enabled = true) {
  return useQuery({
    queryKey: ['products', query],
    queryFn: ({ signal }) => api.get<ProductPage>(`/products?${query}`, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: ({ signal }) => api.get<ProductDetail>(`/products/${encodeURIComponent(slug)}`, { signal }),
  })
}

export function useSuggestions(q: string) {
  return useQuery({
    queryKey: ['suggest', q],
    queryFn: ({ signal }) =>
      api.get<{ items: ProductCard[]; total: number; phrases: string[] }>(`/search/suggest?q=${encodeURIComponent(q)}`, { signal }),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
  })
}

/** "Trending searches" shown when the search box is focused and empty. */
export function useTrending(enabled: boolean) {
  return useQuery({
    queryKey: ['trending'],
    queryFn: ({ signal }) => api.get<{ items: string[] }>('/search/trending', { signal }),
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useHomeLayout() {
  return useQuery({
    queryKey: ['home'],
    queryFn: ({ signal }) => api.get<{ sections: HomeSectionRef[] }>('/home', { signal }),
  })
}

/** One homepage block. `viewed` (recently viewed slugs) is sent only by blocks that use it. */
export function useHomeSection<T>(key: string, viewed?: string[]) {
  const qs = viewed ? `?viewed=${encodeURIComponent(viewed.join(','))}` : ''
  return useQuery({
    queryKey: ['home', key, viewed ?? null],
    queryFn: ({ signal }) => api.get<HomeSection<T>>(`/home/sections/${encodeURIComponent(key)}${qs}`, { signal }),
    placeholderData: (prev) => prev,
  })
}

export interface CatalogInfo {
  key: 'demo' | 'eneba'
  products: number
  snapshotAt: string | null
}

export function useCatalogs() {
  return useQuery({
    queryKey: ['catalogs'],
    queryFn: ({ signal }) => api.get<{ catalogs: CatalogInfo[] }>('/catalogs', { signal }),
    staleTime: 10 * 60_000,
  })
}
