import { useEffect, useRef } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { ApiError } from '../../api/client'
import { useCreateOrder } from '../../api/orders'
import { Container } from '../../components/Container'
import { ErrorState } from '../../components/States'
import { useI18n } from '../../i18n/useI18n'
import { useCart } from '../cart/useCart'
import styles from './checkout.module.css'

/**
 * "Proceed to checkout": like Eneba, there is no separate review screen — the order is created
 * right away (reserving the keys) and the buyer lands on Payment. Creating twice is harmless:
 * the request carries an idempotency key, so a refresh returns the same order.
 */
export function CheckoutPage() {
  const { cart, isLoading, isError, error, refetch } = useCart()
  const create = useCreateOrder()
  const navigate = useNavigate()
  const { t } = useI18n()
  const started = useRef(false)

  useEffect(() => {
    document.title = t('Checkout — keyshop')
  }, [t])

  useEffect(() => {
    if (!cart || cart.lines.length === 0 || started.current) return
    const blocked = cart.lines.some((l) => !l.available || l.quantity > l.stock)
    if (blocked) return
    started.current = true
    create.mutate(cart, {
      onSuccess: (order) => navigate(`/checkout/${order.id}/pay`, { replace: true }),
      onError: (e) => {
        // Prices or stock changed: reload the cart so the buyer sees the current state.
        if (e instanceof ApiError && ['price_changed', 'out_of_stock', 'offer_unavailable'].includes(e.code)) refetch()
      },
    })
  }, [cart, create, navigate, refetch])

  if (isError) return <Container className={styles.page}><ErrorState error={error} onRetry={refetch} /></Container>
  if (!isLoading && cart && cart.lines.length === 0 && !create.isPending && !create.isSuccess) return <Navigate to="/cart" replace />
  if (cart?.lines.some((l) => !l.available || l.quantity > l.stock)) return <Navigate to="/cart" replace />

  const err = create.error instanceof ApiError ? create.error : null
  return (
    <Container className={styles.page}>
      {create.isError ? (
        <div className={styles.preparing} role="alert">
          <p>{err ? err.message : t('Something went wrong while loading this.')}</p>
          <Link to="/cart" className={styles.primaryLink}>
            {t('Back to cart')}
          </Link>
        </div>
      ) : (
        <div className={styles.preparing} aria-busy="true">
          <p>{t('Reserving your keys…')}</p>
        </div>
      )}
    </Container>
  )
}
