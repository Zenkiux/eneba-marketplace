import { ShieldCheck } from 'lucide-react'
import { useEffect } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { ApiError } from '../../api/client'
import { useCreateOrder } from '../../api/orders'
import { Container } from '../../components/Container'
import { ErrorState } from '../../components/States'
import { formatCents } from '../../lib/money'
import { useCart } from '../cart/useCart'
import { Steps } from './Steps'
import styles from './checkout.module.css'

/** Review the cart one last time, then create the order (which reserves the keys). */
export function CheckoutPage() {
  const { cart, isLoading, isError, error, refetch } = useCart()
  const create = useCreateOrder()
  const navigate = useNavigate()
  useEffect(() => {
    document.title = 'Checkout — keyshop'
  }, [])

  if (isError) return <Container className={styles.page}><ErrorState error={error} onRetry={refetch} /></Container>
  if (isLoading || !cart) return <Container className={styles.page}><div aria-busy="true" style={{ minHeight: '50vh' }} /></Container>
  if (cart.lines.length === 0 && !create.isPending && !create.isSuccess) return <Navigate to="/cart" replace />

  const blocked = cart.lines.some((l) => !l.available || l.quantity > l.stock)
  const err = create.error instanceof ApiError ? create.error : null

  function placeOrder() {
    if (!cart) return
    create.mutate(cart, {
      onSuccess: (order) => navigate(`/checkout/${order.id}/pay`),
      onError: (e) => {
        // Prices or stock changed: reload the cart so the buyer sees the current state.
        if (e instanceof ApiError && ['price_changed', 'out_of_stock', 'offer_unavailable'].includes(e.code)) refetch()
      },
    })
  }

  return (
    <Container className={styles.page}>
      <Steps current="Checkout" />
      <h1 className={styles.h1}>Checkout</h1>
      <div className={styles.layout}>
        <section className={styles.panel} aria-labelledby="review-h">
          <h2 id="review-h" className={styles.h2}>
            Review your order
          </h2>
          <ul className={styles.items}>
            {cart.lines.map((l) => (
              <li key={l.offerId} className={styles.item}>
                <img referrerPolicy="no-referrer" src={l.product.coverUrl} alt="" width={48} height={72} />
                <div>
                  <span className={styles.itemTitle}>{l.product.title}</span>
                  <span className={styles.itemMeta}>
                    Seller: {l.seller.name} · {l.quantity} × {formatCents(l.priceCents, l.currency)}
                  </span>
                  {!l.available && <span className={styles.warn}>No longer available</span>}
                  {l.available && l.quantity > l.stock && <span className={styles.warn}>Only {l.stock} left</span>}
                </div>
                <strong>{formatCents(l.priceCents * l.quantity, l.currency)}</strong>
              </li>
            ))}
          </ul>
          <p className={styles.delivery}>Keys are delivered on the order page immediately after payment and stay in your order history.</p>
        </section>

        <aside className={styles.summary} aria-label="Total">
          <div className={styles.totalRow}>
            <span>Total</span>
            <strong className={styles.total}>{formatCents(cart.totalCents)}</strong>
          </div>
          {err && (
            <p className={styles.error} role="alert">
              {err.message}
              {err.code === 'price_changed' && ' The cart now shows the current prices.'}
            </p>
          )}
          {blocked && (
            <p className={styles.error} role="alert">
              Fix the items marked above in your <Link to="/cart">cart</Link> first.
            </p>
          )}
          <button type="button" className={styles.primary} disabled={blocked || create.isPending} onClick={placeOrder}>
            {create.isPending ? 'Reserving your keys…' : 'Continue to payment'}
          </button>
          <p className={styles.note}>
            <ShieldCheck size={16} aria-hidden="true" /> Your keys are reserved for 15 minutes while you pay. Demo shop: no real money is charged.
          </p>
          <Link to="/cart" className={styles.back}>
            Back to cart
          </Link>
        </aside>
      </div>
    </Container>
  )
}
