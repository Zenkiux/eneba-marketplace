import { Check, Copy, KeyRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { useOrder, type Order } from '../../api/orders'
import { Container } from '../../components/Container'
import { ErrorState } from '../../components/States'
import { formatCents } from '../../lib/money'
import { NotFoundPage } from '../not-found/NotFoundPage'
import { Steps } from '../checkout/Steps'
import { StatusBadge } from './StatusBadge'
import styles from '../checkout/checkout.module.css'

/** Order detail. For a paid order this is where the buyer receives their keys. */
export function OrderPage() {
  const { id = '' } = useParams()
  const { data: o, isPending, isError, error, refetch } = useOrder(id)
  useEffect(() => {
    document.title = 'Your order — keyshop'
  }, [])
  if (isError && error instanceof ApiError && error.status === 404) return <NotFoundPage />
  if (isError) return <Container className={styles.page}><ErrorState error={error} onRetry={() => void refetch()} /></Container>
  if (isPending) return <Container className={styles.page}><div aria-busy="true" style={{ minHeight: '50vh' }} /></Container>
  return <OrderView o={o} />
}

function OrderView({ o }: { o: Order }) {
  const paid = o.status === 'paid'
  return (
    <Container className={styles.page}>
      {paid && <Steps current="Order and key" />}
      <div className={styles.orderHead}>
        <h1 className={styles.h1}>{paid ? 'Thank you! Here are your keys' : 'Order details'}</h1>
        <StatusBadge status={o.status} />
      </div>
      <p className={styles.orderMeta}>
        Order <code>{o.id}</code> · {new Date(o.createdAt).toLocaleString('en-IE')}
        {o.paidAt && <> · paid {new Date(o.paidAt).toLocaleString('en-IE')}</>}
      </p>
      {o.status === 'pending_payment' && (
        <p className={styles.notice}>
          This order is waiting for payment. <Link to={`/checkout/${o.id}/pay`}>Continue to payment</Link>
        </p>
      )}

      <ul className={styles.keyList}>
        {o.items.map((it) => (
          <li key={it.offerId} className={styles.keyItem}>
            <img referrerPolicy="no-referrer" src={it.coverUrl} alt="" width={64} height={96} />
            <div className={styles.keyBody}>
              <Link to={`/p/${it.productSlug}`} className={styles.itemTitle}>
                {it.title}
              </Link>
              <span className={styles.itemMeta}>
                Seller: {it.seller} · {it.quantity} × {formatCents(it.unitPriceCents, o.currency)}
              </span>
              {paid && it.keys && (
                <ul className={styles.codes} aria-label={`Keys for ${it.title}`}>
                  {it.keys.map((k) => (
                    <KeyCode key={k} code={k} />
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className={styles.orderFoot}>
        <span>
          Total <strong className={styles.total}>{formatCents(o.totalCents, o.currency)}</strong>
        </span>
        <Link to="/account/orders" className={styles.back}>
          All my orders
        </Link>
      </div>
      {paid && <p className={styles.note}>These are demo keys for a fictional shop — they cannot be redeemed anywhere.</p>}
    </Container>
  )
}

function KeyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <li className={styles.code}>
      <KeyRound size={18} aria-hidden="true" />
      <code data-testid="game-key">{code}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(code).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          })
        }}
        aria-label={`Copy key ${code}`}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy'}
      </button>
    </li>
  )
}
