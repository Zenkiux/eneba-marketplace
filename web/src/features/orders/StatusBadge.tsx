import type { OrderStatus } from '../../api/orders'
import styles from '../checkout/checkout.module.css'

const LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Awaiting payment',
  paid: 'Paid',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

const CLASSES: Record<OrderStatus, string | undefined> = {
  pending_payment: styles.pendingPayment,
  paid: styles.paid,
  cancelled: styles.cancelled,
  expired: styles.expired,
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`${styles.badge} ${CLASSES[status] ?? ''}`}>{LABELS[status]}</span>
}
