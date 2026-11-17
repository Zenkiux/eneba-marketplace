import { ShieldCheck } from 'lucide-react'
import { useEffect } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { ApiError } from '../../api/client'
import { useCreateOrder } from '../../api/orders'
import { Container } from '../../components/Container'
import { ErrorState } from '../../components/States'
import { rich } from '../../i18n/rich'
import { useI18n } from '../../i18n/useI18n'
import { useCart } from '../cart/useCart'
import { Steps } from './Steps'
import styles from './checkout.module.css'

/** Review the cart one last time, then create the order (which reserves the keys). */
export function CheckoutPage() {
  const { cart, isLoading, isError, error, refetch } = useCart()
  const create = useCreateOrder()
  const navigate = useNavigate()
  const { t, money, eur, converted } = useI18n()
  useEffect(() => {
    document.title = t('Checkout — keyshop')
  }, [t])

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
      <h1 className={styles.h1}>{t('Checkout')}</h1>
      <div className={styles.layout}>
        <section className={styles.panel} aria-labelledby="review-h">
          <h2 id="review-h" className={styles.h2}>
            {t('Review your order')}
          </h2>
          <ul className={styles.items}>
            {cart.lines.map((l) => (
              <li key={l.offerId} className={styles.item}>
                <img referrerPolicy="no-referrer" src={l.product.coverUrl} alt="" width={48} height={72} />
                <div>
                  <span className={styles.itemTitle}>{l.product.title}</span>
                  <span className={styles.itemMeta}>
                    {t('Seller:')} {l.seller.name} · {l.quantity} × {money(l.priceCents)}
                  </span>
                  {!l.available && <span className={styles.warn}>{t('No longer available')}</span>}
                  {l.available && l.quantity > l.stock && <span className={styles.warn}>{t('Only {n} left', { n: l.stock })}</span>}
                </div>
                <strong>{money(l.priceCents * l.quantity)}</strong>
              </li>
            ))}
          </ul>
          <p className={styles.delivery}>{t('Keys are delivered on the order page immediately after payment and stay in your order history.')}</p>
        </section>

        <aside className={styles.summary} aria-label={t('Total')}>
          <div className={styles.totalRow}>
            <span>{t('Total')}</span>
            <strong className={styles.total}>{money(cart.totalCents)}</strong>
          </div>
          {converted && <p className={styles.charged}>{t('Charged in EUR: {amount}', { amount: eur(cart.totalCents) })}</p>}
          {err && (
            <p className={styles.error} role="alert">
              {err.message}
              {err.code === 'price_changed' && ` ${t('The cart now shows the current prices.')}`}
            </p>
          )}
          {blocked && (
            <p className={styles.error} role="alert">
              {rich(t('Fix the items marked above in your {cart} first.'), { cart: <Link to="/cart">{t('cart')}</Link> })}
            </p>
          )}
          <button type="button" className={styles.primary} disabled={blocked || create.isPending} onClick={placeOrder}>
            {create.isPending ? t('Reserving your keys…') : t('Continue to payment')}
          </button>
          <p className={styles.note}>
            <ShieldCheck size={16} aria-hidden="true" />{' '}
            {t('Your keys are reserved for 15 minutes while you pay. Demo shop: no real money is charged.')}
          </p>
          <Link to="/cart" className={styles.back}>
            {t('Back to cart')}
          </Link>
        </aside>
      </div>
    </Container>
  )
}
