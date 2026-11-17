import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMe, type User } from './auth'
import { api } from './client'
import type { ProductCard } from './types'

export interface Session {
  id: number
  createdAt: string
  lastSeenAt: string
  country: string
  userAgent: string
  current: boolean
}

export function useSessions() {
  return useQuery({
    queryKey: ['account', 'sessions'],
    queryFn: ({ signal }) => api.get<{ sessions: Session[] }>('/account/sessions', { signal }),
  })
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ revoked: number }>('/account/sessions/revoke-others'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['account', 'sessions'] }),
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (displayName: string) => api.patch<{ user: User }>('/account/profile', { displayName }),
    onSuccess: ({ user }) => qc.setQueryData(['me'], user),
  })
}

export function useChangePassword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) => api.post('/account/password', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['account', 'sessions'] }),
  })
}

// ---------------------------------------------------------------- favourites

/** The signed-in user's favourites (empty for guests, who are asked to log in instead). */
export function useWishlist() {
  const me = useMe()
  return useQuery({
    queryKey: ['wishlist'],
    queryFn: ({ signal }) => api.get<{ items: ProductCard[] }>('/wishlist', { signal }),
    enabled: !!me.data,
  })
}

export function useToggleWishlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, on }: { productId: number; on: boolean }) =>
      on ? api.put<{ items: ProductCard[] }>(`/wishlist/${productId}`) : api.delete<{ items: ProductCard[] }>(`/wishlist/${productId}`),
    onSuccess: (data) => qc.setQueryData(['wishlist'], data),
  })
}
