import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { useMe } from '../../api/auth'
import { ApiError, api } from '../../api/client'
import type { Cart } from '../../api/types'
import { showToast } from '../../components/toastBus'
import { guestCart, MAX_QUANTITY } from './guestCart'

/**
 * One cart interface for the whole app.
 * - Signed out: lines are kept in the browser (guestCart) and resolved through GET /api/offers.
 * - Signed in: the cart lives on the server (/api/cart); the guest cart is merged into it at sign-in.
 * Either way only offer ids and quantities are stored; prices and stock are always live.
 */
export function useCart() {
  const qc = useQueryClient()
  const me = useMe()
  const signedIn = !!me.data
  const guestLines = useSyncExternalStore(guestCart.subscribe, guestCart.get)
  const guestKey = guestLines.map((l) => `${l.offerId}:${l.quantity}`).join(',')

  const server = useQuery({
    queryKey: ['cart'],
    queryFn: ({ signal }) => api.get<Cart>('/cart', { signal }),
    enabled: signedIn,
  })
  const guest = useQuery({
    queryKey: ['guest-cart', guestKey],
    queryFn: ({ signal }) => api.get<Cart>(`/offers?items=${guestKey}`, { signal }),
    enabled: !signedIn && !me.isPending && guestKey !== '',
    placeholderData: (prev) => prev,
  })

  const setServer = useMutation({
    mutationFn: ({ offerId, quantity }: { offerId: number; quantity: number }) =>
      api.put<Cart>(`/cart/items/${offerId}`, { quantity }),
    onSuccess: (cart) => qc.setQueryData(['cart'], cart),
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Could not update the cart'),
  })
  const removeServer = useMutation({
    mutationFn: (offerId: number) => api.delete<Cart>(`/cart/items/${offerId}`),
    onSuccess: (cart) => qc.setQueryData(['cart'], cart),
  })

  const emptyCart: Cart = { lines: [], totalCents: 0, count: 0 }
  const cart = signedIn ? server.data : guestKey === '' ? emptyCart : guest.data
  const count = signedIn ? (server.data?.count ?? 0) : guestLines.reduce((n, l) => n + l.quantity, 0)
  const query = signedIn ? server : guest

  return {
    cart,
    count,
    signedIn,
    isLoading: me.isPending || (cart === undefined && query.isPending),
    isError: query.isError,
    error: query.error,
    refetch: () => void query.refetch(),
    isUpdating: setServer.isPending || removeServer.isPending,

    /** Adds quantity of an offer (capped at the stock shown and 10 per line). */
    add(offerId: number, quantity: number, maxStock: number, label?: string) {
      const cap = Math.min(MAX_QUANTITY, Math.max(maxStock, 1))
      if (signedIn) {
        const current = server.data?.lines.find((l) => l.offerId === offerId)?.quantity ?? 0
        setServer.mutate(
          { offerId, quantity: Math.min(current + quantity, cap) },
          { onSuccess: () => label && showToast(`Added to cart: ${label}`) },
        )
      } else {
        guestCart.add(offerId, quantity, maxStock)
        if (label) showToast(`Added to cart: ${label}`)
      }
    },
    setQuantity(offerId: number, quantity: number) {
      if (signedIn) setServer.mutate({ offerId, quantity })
      else guestCart.set(offerId, quantity)
    },
    remove(offerId: number) {
      if (signedIn) removeServer.mutate(offerId)
      else guestCart.remove(offerId)
    },
  }
}
