import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Cart } from './types'

export type OrderStatus = 'pending_payment' | 'paid' | 'cancelled' | 'expired'

export interface OrderItem {
  offerId: number
  productSlug: string
  title: string
  coverUrl: string
  seller: string
  unitPriceCents: number
  quantity: number
  keys?: string[]
}

export interface Order {
  id: string
  status: OrderStatus
  totalCents: number
  currency: string
  createdAt: string
  expiresAt: string
  paidAt: string | null
  lastPayment: 'succeeded' | 'declined' | null
  paymentMethod: string | null
  items: OrderItem[]
  itemCount: number
  secondsToExpiry: number
}

export function useOrders() {
  return useQuery({ queryKey: ['orders'], queryFn: ({ signal }) => api.get<{ orders: Order[] }>('/orders', { signal }) })
}

export function useOrder(id: string) {
  return useQuery({ queryKey: ['orders', id], queryFn: ({ signal }) => api.get<Order>(`/orders/${encodeURIComponent(id)}`, { signal }) })
}

/**
 * One idempotency key per checkout attempt, remembered for the same cart contents and total.
 * A double click, a refresh or a retry after a network error re-sends the same key, so the
 * server returns the order it already created instead of making a second one.
 */
function checkoutKey(cart: Cart): string {
  const signature = cart.lines.map((l) => `${l.offerId}x${l.quantity}`).join(',') + `=${cart.totalCents}`
  const storageKey = `keyshop.checkout.${signature}`
  try {
    const existing = sessionStorage.getItem(storageKey)
    if (existing) return existing
    const fresh = crypto.randomUUID()
    sessionStorage.setItem(storageKey, fresh)
    return fresh
  } catch {
    return crypto.randomUUID()
  }
}

export function forgetCheckoutKeys() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith('keyshop.checkout.'))
      .forEach((k) => sessionStorage.removeItem(k))
  } catch {
    // storage unavailable: nothing to forget
  }
}

export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (cart: Cart) =>
      api.post<Order>(
        '/orders',
        { items: cart.lines.map((l) => ({ offerId: l.offerId, quantity: l.quantity })), expectedTotalCents: cart.totalCents },
        { headers: { 'Idempotency-Key': checkoutKey(cart) } },
      ),
    onSuccess: (order) => {
      qc.setQueryData(['orders', order.id], order)
      void qc.invalidateQueries({ queryKey: ['orders'], exact: true })
    },
  })
}

export function usePayOrder(id: string) {
  const qc = useQueryClient()
  return useMutation({
    // A fresh attempt key per click; the server ignores a repeated key and returns its first result.
    mutationFn: ({ outcome, method }: { outcome: 'success' | 'decline'; method: string }) =>
      api.post<Order>(`/orders/${id}/payments`, { outcome, method }, { headers: { 'Idempotency-Key': crypto.randomUUID() } }),
    onSuccess: (order) => {
      qc.setQueryData(['orders', id], order)
      forgetCheckoutKeys()
      void qc.invalidateQueries({ queryKey: ['cart'] })
      void qc.invalidateQueries({ queryKey: ['orders'], exact: true })
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['product'] })
    },
    onError: () => void qc.invalidateQueries({ queryKey: ['orders', id] }),
  })
}

export function useCancelOrder(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<Order>(`/orders/${id}/cancel`),
    onSuccess: (order) => {
      qc.setQueryData(['orders', id], order)
      forgetCheckoutKeys()
      void qc.invalidateQueries({ queryKey: ['orders'], exact: true })
    },
  })
}
