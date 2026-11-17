import { Minus, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import type { CartLine } from '../../api/types'
import { Container } from '../../components/Container'
import { EmptyState, ErrorState } from '../../components/States'
import { formatCents } from '../../lib/money'
import { MAX_QUANTITY } from './guestCart'
import { useCart } from './useCart'
import styles from './CartPage.module.css'

export function CartPage() {
  const { cart, isLoading, isError, error, refetch, setQuantity, remove, signedIn, isUpdating } = useCart()
  const navigate = useNavigate()
  useEffect(() => {
    document.title = 'Cart — keyshop'
  }, [])

  if (isError) {
    return (
      <Container className={styles.page}>
        <ErrorState error={error} onRetry={refetch} />
      </Container>
    )
  }
  if (isLoading || !cart) return <Container className={styles.page}><div aria-busy="true" style={{ minHeight: '50vh' }} /></Container>

  if (cart.lines.length === 0) {
    return (
      <Container className={styles.page}>
        <h1 className={styles.h1}>Cart</h1>
        <EmptyState title="Your cart is empty">
          <p>Find a game and choose a seller’s offer to add it here.</p>
          <Link to="/store" className={styles.primaryLink}>
            Browse the store
          </Link>
        </EmptyState>
      </Container>
    )
  }

  const unavailable = cart.lines.filter((l) => !l.available || l.quantity > l.stock)
  const canCheckout = unavailable.length === 0 && cart.totalCents > 0
  return (
    <Container className={styles.page}>
      <h1 className={styles.h1}>Cart</h1>
      <div className={styles.layout}>
        <ul className={styles.lines} aria-busy={isUpdating}>
          {cart.lines.map((l) => (
            <Line key={l.offerId} line={l} onQuantity={(q) => setQuantity(l.offerId, q)} onRemove={() => remove(l.offerId)} />
          ))}
        </ul>
        <aside className={styles.summary} aria-label="Order summary">
          <h2 className={styles.h2}>Summary</h2>
          <dl className={styles.totals}>
            <dt>Items</dt>
            <dd>{cart.count}</dd>
            <dt className={styles.totalLabel}>Total</dt>
            <dd className={styles.total}>{formatCents(cart.totalCents)}</dd>
          </dl>
          {unavailable.length > 0 && (
            <p className={styles.warning} role="alert">
              Some items are sold out or exceed the seller’s stock. Remove them or lower the quantity to continue.
            </p>
          )}
          <button type="button" className={styles.checkout} disabled={!canCheckout} onClick={() => navigate('/checkout')}>
            {signedIn ? 'Proceed to checkout' : 'Log in and checkout'}
          </button>
          <p className={styles.note}>
            <ShieldCheck size={16} aria-hidden="true" /> Demo shop: payment is simulated and no real money is charged. Prices are checked again at checkout.
          </p>
        </aside>
      </div>
    </Container>
  )
}

function Line({ line: l, onQuantity, onRemove }: { line: CartLine; onQuantity: (q: number) => void; onRemove: () => void }) {
  const max = Math.min(MAX_QUANTITY, Math.max(l.stock, 1))
  return (
    <li className={l.available ? styles.line : `${styles.line} ${styles.lineUnavailable}`}>
      <Link to={`/p/${l.product.slug}`} className={styles.thumb} tabIndex={-1} aria-hidden="true">
        <img src={l.product.coverUrl} alt="" width={70} height={105} />
      </Link>
      <div className={styles.info}>
        <Link to={`/p/${l.product.slug}`} className={styles.title}>
          {l.product.title}
        </Link>
        <span className={styles.meta}>
          Seller: <strong>{l.seller.name}</strong> · {l.seller.rating.toFixed(2)}
        </span>
        <span className={styles.region}>{l.product.region.name}</span>
        {!l.available ? (
          <span className={styles.stockWarning}>No longer available from this seller</span>
        ) : (
          l.quantity > l.stock && <span className={styles.stockWarning}>Only {l.stock} left</span>
        )}
      </div>
      <div className={styles.qty} role="group" aria-label={`Quantity for ${l.product.title}`}>
        <button type="button" aria-label="Decrease quantity" disabled={l.quantity <= 1} onClick={() => onQuantity(l.quantity - 1)}>
          <Minus size={16} />
        </button>
        <span aria-live="polite">{l.quantity}</span>
        <button type="button" aria-label="Increase quantity" disabled={l.quantity >= max || !l.available} onClick={() => onQuantity(l.quantity + 1)}>
          <Plus size={16} />
        </button>
      </div>
      <span className={styles.price}>{formatCents(l.priceCents * l.quantity, l.currency)}</span>
      <button type="button" className={styles.remove} aria-label={`Remove ${l.product.title}`} onClick={onRemove}>
        <Trash2 size={18} />
      </button>
    </li>
  )
}
