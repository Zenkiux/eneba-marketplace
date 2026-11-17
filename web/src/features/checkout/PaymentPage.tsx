import { CircleAlert, CreditCard, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { useCancelOrder, useOrder, usePayOrder } from '../../api/orders'
import { Container } from '../../components/Container'
import { ErrorState } from '../../components/States'
import { rich } from '../../i18n/rich'
import { useI18n } from '../../i18n/useI18n'
import { Steps } from './Steps'
import styles from './checkout.module.css'

function useCountdown(seconds: number | undefined, fetchedAt: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (seconds === undefined) return null
  return Math.max(0, seconds - Math.floor((now - fetchedAt) / 1000))
}

/** Simulated payment: clearly labelled, no card data, but a real payment lifecycle on the server. */
export function PaymentPage() {
  const { id = '' } = useParams()
  const order = useOrder(id)
  const pay = usePayOrder(id)
  const cancel = useCancelOrder(id)
  const navigate = useNavigate()
  const { t, money, eur, converted } = useI18n()
  const left = useCountdown(order.data?.status === 'pending_payment' ? order.data.secondsToExpiry : undefined, order.dataUpdatedAt)
  useEffect(() => {
    document.title = t('Payment — keyshop')
  }, [t])

  if (order.isError) {
    return (
      <Container className={styles.page}>
        <ErrorState error={order.error} onRetry={() => void order.refetch()} />
      </Container>
    )
  }
  if (order.isPending) return <Container className={styles.page}><div aria-busy="true" style={{ minHeight: '50vh' }} /></Container>
  const o = order.data
  if (o.status === 'paid') return <Navigate to={`/orders/${o.id}`} replace />

  const closed = o.status !== 'pending_payment' || left === 0
  const err = pay.error instanceof ApiError ? pay.error : null

  return (
    <Container className={styles.page}>
      <Steps current="Payment" />
      <h1 className={styles.h1}>{t('Payment')}</h1>
      <div className={styles.layout}>
        <section className={styles.panel} aria-labelledby="pay-h">
          <div className={styles.demoBanner}>
            <CreditCard size={22} aria-hidden="true" />
            <div>
              <h2 id="pay-h" className={styles.h2}>
                {t('Demo payment — no real money is charged')}
              </h2>
              <p>
                {t(
                  'This shop uses a simulated payment provider. Choose the outcome to test both paths. A successful payment marks the order as paid and releases your keys; a declined one keeps them reserved so you can try again.',
                )}
              </p>
            </div>
          </div>

          {closed ? (
            <div className={styles.closed} role="alert">
              <CircleAlert size={20} aria-hidden="true" />
              <p>
                {o.status === 'cancelled'
                  ? t('This order was cancelled and its keys went back on sale.')
                  : t('The 15-minute reservation for this order ran out and its keys went back on sale.')}{' '}
                {rich(t('{link} to check out again.'), { link: <Link to="/cart">{t('Return to your cart')}</Link> })}
              </p>
            </div>
          ) : (
            <>
              {left !== null && (
                <p className={styles.timer} aria-live="off">
                  {t('Keys reserved for')} <strong>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</strong>
                </p>
              )}
              {err && (
                <p className={styles.error} role="alert">
                  {err.message}
                </p>
              )}
              <div className={styles.payButtons}>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={pay.isPending || cancel.isPending}
                  onClick={() => pay.mutate('success', { onSuccess: (paid) => navigate(`/orders/${paid.id}`, { replace: true }) })}
                >
                  {pay.isPending && pay.variables === 'success'
                    ? t('Processing…')
                    : t('Simulate successful payment · {amount}', { amount: money(o.totalCents) })}
                </button>
                <button type="button" className={styles.secondary} disabled={pay.isPending || cancel.isPending} onClick={() => pay.mutate('decline')}>
                  {t('Simulate declined payment')}
                </button>
              </div>
              <button type="button" className={styles.linkButton} disabled={cancel.isPending} onClick={() => cancel.mutate()}>
                {t('Cancel order and release the keys')}
              </button>
            </>
          )}
        </section>

        <aside className={styles.summary} aria-label={t('Order summary')}>
          <h2 className={styles.h2}>{t('Order summary')}</h2>
          <ul className={styles.compactItems}>
            {o.items.map((it) => (
              <li key={it.offerId}>
                <span>
                  {it.quantity} × {it.title}
                  <small>{t('Seller:')} {it.seller}</small>
                </span>
                <strong>{money(it.unitPriceCents * it.quantity)}</strong>
              </li>
            ))}
          </ul>
          <div className={styles.totalRow}>
            <span>{t('Total')}</span>
            <strong className={styles.total}>{money(o.totalCents)}</strong>
          </div>
          {converted && <p className={styles.charged}>{t('Charged in EUR: {amount}', { amount: eur(o.totalCents) })}</p>}
          <p className={styles.note}>
            <ShieldCheck size={16} aria-hidden="true" /> {t('Order {id}', { id: o.id.slice(0, 8) })}
          </p>
        </aside>
      </div>
    </Container>
  )
}
