import { Ban, CircleAlert, CreditCard, Landmark, ShieldCheck, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { useCancelOrder, useOrder, usePayOrder } from '../../api/orders'
import { Container } from '../../components/Container'
import { ErrorState } from '../../components/States'
import { rich } from '../../i18n/rich'
import { useI18n } from '../../i18n/useI18n'
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

// Demo payment methods in Eneba's list style. No card data is ever collected: each method only
// tells the (simulated) provider which outcome to return.
const METHODS: { id: string; icon: LucideIcon; title: string; detail: string; outcome: 'success' | 'decline' }[] = [
  { id: 'card', icon: CreditCard, title: 'Credit or debit card', detail: 'Demo: the payment will be approved', outcome: 'success' },
  { id: 'wallet', icon: Wallet, title: 'keyshop Wallet', detail: 'Demo balance: the payment will be approved', outcome: 'success' },
  { id: 'bank', icon: Landmark, title: 'Bank link', detail: 'Demo: the payment will be approved', outcome: 'success' },
  { id: 'declined', icon: Ban, title: 'Declined card', detail: 'Demo: the payment will be declined, so you can test a retry', outcome: 'decline' },
]

/** Eneba-style payment step: method list on the left, order summary with "Continue" on the right. */
export function PaymentPage() {
  const { id = '' } = useParams()
  const order = useOrder(id)
  const pay = usePayOrder(id)
  const cancel = useCancelOrder(id)
  const navigate = useNavigate()
  const { t, money, eur, converted } = useI18n()
  const [method, setMethod] = useState<string | null>(null)
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
  const chosen = METHODS.find((m) => m.id === method)
  const sellers = [...new Set(o.items.map((it) => it.seller))]

  function submit() {
    if (!chosen) return
    pay.mutate({ outcome: chosen.outcome, method: chosen.id }, { onSuccess: (paid) => navigate(`/orders/${paid.id}`, { replace: true }) })
  }

  return (
    <Container className={styles.page}>
      <div className={styles.payLayout}>
        <section aria-labelledby="pay-h">
          <div className={styles.demoBanner}>
            <ShieldCheck size={20} aria-hidden="true" />
            <div>
              <h1 id="pay-h" className={styles.demoTitle}>
                {t('Demo payment — no real money is charged')}
              </h1>
              <p>{t('Choose a demo method to test both outcomes. No card details are asked for or stored.')}</p>
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
              {err && (
                <p className={styles.error} role="alert">
                  {err.message}
                </p>
              )}
              <div className={styles.methods} role="radiogroup" aria-label={t('Payment method')}>
                {METHODS.map((m) => {
                  const Icon = m.icon
                  const selected = method === m.id
                  return (
                    <label key={m.id} className={selected ? `${styles.method} ${styles.methodSelected}` : styles.method}>
                      <input type="radio" name="method" value={m.id} checked={selected} onChange={() => setMethod(m.id)} className={styles.methodInput} />
                      <span className={m.outcome === 'decline' ? `${styles.methodLogo} ${styles.methodLogoDecline}` : styles.methodLogo} aria-hidden="true">
                        <Icon size={22} />
                      </span>
                      <span className={styles.methodText}>
                        <strong>{t(m.title)}</strong>
                        <small>{t(m.detail)}</small>
                      </span>
                      <span className={styles.radio} aria-hidden="true" />
                    </label>
                  )
                })}
              </div>
              <button type="button" className={styles.linkButton} disabled={cancel.isPending} onClick={() => cancel.mutate()}>
                {t('Cancel order and release the keys')}
              </button>
            </>
          )}
        </section>

        <aside className={styles.paySummary} aria-label={t('Order summary')}>
          {left !== null && !closed && (
            <p className={styles.timer}>
              {t('Keys reserved for')} <strong>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</strong>
            </p>
          )}
          <ul className={styles.summaryItems}>
            {o.items.map((it) => (
              <li key={it.offerId}>
                <span className={styles.soldBy}>
                  {t('Sold by')} <strong>{it.seller}</strong>
                </span>
                <div className={styles.summaryItem}>
                  <img referrerPolicy="no-referrer" src={it.coverUrl} alt="" width={50} height={75} />
                  <div>
                    <Link to={`/p/${it.productSlug}`} className={styles.itemTitle}>
                      {it.title}
                    </Link>
                    <span className={styles.itemMeta}>{t('Digital product')}</span>
                    <span className={styles.itemMeta}>
                      {it.quantity} × {money(it.unitPriceCents)}
                    </span>
                  </div>
                  <strong className={styles.itemPrice}>{money(it.unitPriceCents * it.quantity)}</strong>
                </div>
              </li>
            ))}
          </ul>
          <dl className={styles.sumRows}>
            <dt>{t('Sub-total')}</dt>
            <dd>{money(o.totalCents)}</dd>
            <dt>{t('Service fee')}</dt>
            <dd>{money(0)}</dd>
            <dt className={styles.sumTotalLabel}>{t('Total:')}</dt>
            <dd className={styles.total}>{money(o.totalCents)}</dd>
          </dl>
          {converted && <p className={styles.charged}>{t('Charged in EUR: {amount}', { amount: eur(o.totalCents) })}</p>}
          <p className={styles.collected}>{t('Payment collected on behalf of {sellers}', { sellers: sellers.join(', ') })}</p>
          {!closed && (
            <>
              <button type="button" className={styles.continue} disabled={!chosen || pay.isPending || cancel.isPending} onClick={submit}>
                {pay.isPending ? t('Processing…') : t('Continue')}
              </button>
              {!chosen && <p className={styles.hint}>{t('Choose a payment method to continue.')}</p>}
              <p className={styles.terms}>{t('By clicking “Continue” you confirm this is a demo purchase: no real money is charged and the keys are fictional.')}</p>
            </>
          )}
        </aside>
      </div>
    </Container>
  )
}
