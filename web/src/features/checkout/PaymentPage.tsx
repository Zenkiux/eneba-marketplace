import { CircleAlert, CreditCard, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { useCancelOrder, useOrder, usePayOrder } from '../../api/orders'
import { Container } from '../../components/Container'
import { ErrorState } from '../../components/States'
import { formatCents } from '../../lib/money'
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
  const left = useCountdown(order.data?.status === 'pending_payment' ? order.data.secondsToExpiry : undefined, order.dataUpdatedAt)
  useEffect(() => {
    document.title = 'Payment — keyshop'
  }, [])

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
      <h1 className={styles.h1}>Payment</h1>
      <div className={styles.layout}>
        <section className={styles.panel} aria-labelledby="pay-h">
          <div className={styles.demoBanner}>
            <CreditCard size={22} aria-hidden="true" />
            <div>
              <h2 id="pay-h" className={styles.h2}>
                Demo payment — no real money is charged
              </h2>
              <p>
                This shop uses a simulated payment provider. Choose the outcome to test both paths. A successful payment
                marks the order as paid and releases your keys; a declined one keeps them reserved so you can try again.
              </p>
            </div>
          </div>

          {closed ? (
            <div className={styles.closed} role="alert">
              <CircleAlert size={20} aria-hidden="true" />
              <p>
                {o.status === 'cancelled'
                  ? 'This order was cancelled and its keys went back on sale.'
                  : 'The 15-minute reservation for this order ran out and its keys went back on sale.'}{' '}
                <Link to="/cart">Return to your cart</Link> to check out again.
              </p>
            </div>
          ) : (
            <>
              {left !== null && (
                <p className={styles.timer} aria-live="off">
                  Keys reserved for <strong>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</strong>
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
                  {pay.isPending && pay.variables === 'success' ? 'Processing…' : `Simulate successful payment · ${formatCents(o.totalCents, o.currency)}`}
                </button>
                <button type="button" className={styles.secondary} disabled={pay.isPending || cancel.isPending} onClick={() => pay.mutate('decline')}>
                  Simulate declined payment
                </button>
              </div>
              <button type="button" className={styles.linkButton} disabled={cancel.isPending} onClick={() => cancel.mutate()}>
                Cancel order and release the keys
              </button>
            </>
          )}
        </section>

        <aside className={styles.summary} aria-label="Order summary">
          <h2 className={styles.h2}>Order summary</h2>
          <ul className={styles.compactItems}>
            {o.items.map((it) => (
              <li key={it.offerId}>
                <span>
                  {it.quantity} × {it.title}
                  <small>Seller: {it.seller}</small>
                </span>
                <strong>{formatCents(it.unitPriceCents * it.quantity, o.currency)}</strong>
              </li>
            ))}
          </ul>
          <div className={styles.totalRow}>
            <span>Total</span>
            <strong className={styles.total}>{formatCents(o.totalCents, o.currency)}</strong>
          </div>
          <p className={styles.note}>
            <ShieldCheck size={16} aria-hidden="true" /> Order {o.id.slice(0, 8)}
          </p>
        </aside>
      </div>
    </Container>
  )
}
