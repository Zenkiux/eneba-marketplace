import { useEffect } from 'react'
import { Link } from 'react-router'
import { useOrders } from '../../api/orders'
import { Container } from '../../components/Container'
import { EmptyState, ErrorState } from '../../components/States'
import { formatCents } from '../../lib/money'
import { StatusBadge } from '../orders/StatusBadge'
import styles from '../checkout/checkout.module.css'

/** Order history (signed-in only; the API returns only the current user's orders). */
export function OrdersPage() {
  const { data, isPending, isError, error, refetch } = useOrders()
  useEffect(() => {
    document.title = 'My orders — keyshop'
  }, [])
  return (
    <Container className={styles.page}>
      <h1 className={styles.h1}>My orders</h1>
      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div aria-busy="true" style={{ minHeight: '40vh' }} />
      ) : data.orders.length === 0 ? (
        <EmptyState title="No orders yet">
          <p>When you buy something, your order and its keys will appear here.</p>
          <Link to="/store" className={styles.primaryLink}>
            Browse the store
          </Link>
        </EmptyState>
      ) : (
        <ul className={styles.orderList}>
          {data.orders.map((o) => (
            <li key={o.id}>
              <Link to={o.status === 'pending_payment' ? `/checkout/${o.id}/pay` : `/orders/${o.id}`} className={styles.orderRow}>
                <div className={styles.orderCovers} aria-hidden="true">
                  {o.items.slice(0, 3).map((it) => (
                    <img key={it.offerId} src={it.coverUrl} alt="" width={40} height={60} />
                  ))}
                </div>
                <div className={styles.orderInfo}>
                  <span className={styles.itemTitle}>{o.items.map((it) => it.title).join(', ')}</span>
                  <span className={styles.itemMeta}>
                    {new Date(o.createdAt).toLocaleDateString('en-IE', { dateStyle: 'medium' })} · {o.itemCount} {o.itemCount === 1 ? 'key' : 'keys'} ·
                    Sellers: {[...new Set(o.items.map((it) => it.seller))].join(', ')}
                  </span>
                </div>
                <StatusBadge status={o.status} />
                <strong className={styles.orderTotal}>{formatCents(o.totalCents, o.currency)}</strong>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  )
}
