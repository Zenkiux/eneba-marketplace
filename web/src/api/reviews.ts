import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { ProductCard } from './types'

export interface Review {
  id: number
  author: string
  rating: number
  body: string
  createdAt: string
  mine: boolean
}

export interface ReviewPage {
  reviews: Review[]
  total: number
  page: number
  pageSize: number
  canReview: boolean
  mine: Review | null
}

export function useReviews(slug: string, page: number) {
  return useQuery({
    queryKey: ['reviews', slug, page],
    queryFn: ({ signal }) => api.get<ReviewPage>(`/products/${encodeURIComponent(slug)}/reviews?page=${page}`, { signal }),
    placeholderData: (prev) => prev,
  })
}

export function useSaveReview(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { rating: number; body: string } | null) =>
      body
        ? api.put<ReviewPage>(`/products/${encodeURIComponent(slug)}/reviews/mine`, body)
        : api.delete<ReviewPage>(`/products/${encodeURIComponent(slug)}/reviews/mine`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reviews', slug] })
      void qc.invalidateQueries({ queryKey: ['product', slug] })
    },
  })
}

export function useRelated(slug: string) {
  return useQuery({
    queryKey: ['related', slug],
    queryFn: ({ signal }) => api.get<{ items: ProductCard[] }>(`/products/${encodeURIComponent(slug)}/related`, { signal }),
  })
}
