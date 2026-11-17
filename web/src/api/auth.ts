import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { guestCart } from '../features/cart/guestCart'
import { ApiError, api } from './client'

export interface User {
  id: string
  email: string
  displayName: string
  createdAt?: string
}

/** The signed-in user, or null. A 401 from /auth/me simply means "not signed in". */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async ({ signal }) => {
      try {
        return (await api.get<{ user: User }>('/auth/me', { signal })).user
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  })
}

/** After sign-in the browser cart is moved into the account cart, then cleared. */
async function mergeGuestCart() {
  const items = guestCart.get()
  if (items.length === 0) return
  await api.post('/cart/merge', { items })
  guestCart.clear()
}

function useSignIn(path: '/auth/login' | '/auth/register') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { email: string; password: string; displayName?: string }) => {
      const { user } = await api.post<{ user: User }>(path, body)
      await mergeGuestCart()
      return user
    },
    onSuccess: (user) => {
      qc.setQueryData(['me'], user)
      void qc.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}

export const useLogin = () => useSignIn('/auth/login')
export const useRegister = () => useSignIn('/auth/register')

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      qc.setQueryData(['me'], null)
      qc.removeQueries({ queryKey: ['cart'] })
      qc.removeQueries({ queryKey: ['orders'] })
    },
  })
}
