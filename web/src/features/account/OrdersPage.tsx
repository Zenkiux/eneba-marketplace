import { useEffect } from 'react'
import { Link } from 'react-router'
import { useOrders } from '../../api/orders'
import { Container } from '../../components/Container'
import { EmptyState, ErrorState } from '../../components/States'
import { useI18n } from '../../i18n/useI18n'
import { StatusBadge } from '../orders/StatusBadge'
import styles from '../checkout/checkout.module.css'

/** Order history (signed-in only; the API returns only the current user's orders). */
export function OrdersPage() {
  const { data, isPending, isError, error, refetch } = useOrders()
  const { t, money, intl } = useI18n()
  useEffect(() => {
    document.title = t('My orders — keyshop')
  }, [t])
  return (
    <Container className={styles.page}>
      <h1 className={styles.h1}>{t('My orders')}</h1>
      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div aria-busy="true" style={{ minHeight: '40vh' }} />
      ) : data.orders.length === 0 ? (
        <EmptyState title={t('No orders yet')}>
          <p>{t('When you buy something, your order and its keys will appear here.')}</p>
          <Link to="/store" className={styles.primaryLink}>
            {t('Browse the store')}
          </Link>
        </EmptyState>
      ) : (
        <ul className={styles.orderList}>
          {data.orders.map((o) => (
            <li key={o.id}>
              <Link to={o.status === 'pending_payment' ? `/checkout/${o.id}/pay` : `/orders/${o.id}`} className={styles.orderRow}>
                <div className={styles.orderCovers} aria-hidden="true">
                  {o.items.slice(0, 3).map((it) => (
                    <img key={it.offerId} referrerPolicy="no-referrer" src={it.coverUrl} alt="" width={40} height={60} />
                  ))}
                </div>
                <div className={styles.orderInfo}>
                  <span className={styles.itemTitle}>{o.items.map((it) => it.title).join(', ')}</span>
                  <span className={styles.itemMeta}>
                    {new Date(o.createdAt).toLocaleDateString(intl, { dateStyle: 'medium' })} ·{' '}
                    {o.itemCount === 1 ? t('1 key') : t('{n} keys', { n: o.itemCount })} ·{' '}
                    {t('Sellers: {sellers}', { sellers: [...new Set(o.items.map((it) => it.seller))].join(', ') })}
                  </span>
                </div>
                <StatusBadge status={o.status} />
                <strong className={styles.orderTotal}>{money(o.totalCents)}</strong>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  )
}
