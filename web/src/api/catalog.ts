import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from './client'
import type { HomeSection, HomeSectionRef, ProductCard, ProductDetail, ProductPage } from './types'

export function useProducts(query: string) {
  return useQuery({
    queryKey: ['products', query],
    queryFn: ({ signal }) => api.get<ProductPage>(`/products?${query}`, { signal }),
    placeholderData: keepPreviousData,
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
      api.get<{ items: ProductCard[] }>(`/search/suggest?q=${encodeURIComponent(q)}`, { signal }),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
  })
}

export function useHomeLayout() {
  return useQuery({
    queryKey: ['home'],
    queryFn: ({ signal }) => api.get<{ sections: HomeSectionRef[] }>('/home', { signal }),
  })
}

export function useHomeSection<T>(key: string) {
  return useQuery({
    queryKey: ['home', key],
    queryFn: ({ signal }) => api.get<HomeSection<T>>(`/home/sections/${encodeURIComponent(key)}`, { signal }),
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
