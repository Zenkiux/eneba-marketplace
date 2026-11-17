import { Minus, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { useProducts } from '../../api/catalog'
import type { CartLine } from '../../api/types'
import { Container } from '../../components/Container'
import { ProductRow } from '../../components/ProductRow'
import { EmptyState, ErrorState } from '../../components/States'
import { useI18n } from '../../i18n/useI18n'
import { ProposalNote } from '../proposal/ProposalNote'
import { useDevice } from '../compat/useDevice'
import { PART_LABEL, verdictFor } from '../compat/verdict'
import { MAX_QUANTITY } from './guestCart'
import { useCart } from './useCart'
import styles from './CartPage.module.css'

/** Eneba-style cart: "My cart" panel with seller-grouped lines, "Summary" panel, recommendations. */
export function CartPage() {
  const { cart, isLoading, isError, error, refetch, setQuantity, remove, signedIn, isUpdating } = useCart()
  const navigate = useNavigate()
  const { t, money, eur, converted } = useI18n()
  useEffect(() => {
    document.title = t('Cart — keyshop')
  }, [t])

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
        <h1 className={styles.h1}>{t('My cart')}</h1>
        <EmptyState title={t('Your cart is empty')}>
          <p>{t('Find a game and choose a seller’s offer to add it here.')}</p>
          <Link to="/store" className={styles.primaryLink}>
            {t('Browse the store')}
          </Link>
        </EmptyState>
        <Recommendations exclude={[]} />
      </Container>
    )
  }

  const unavailable = cart.lines.filter((l) => !l.available || l.quantity > l.stock)
  const canCheckout = unavailable.length === 0 && cart.totalCents > 0
  return (
    <Container className={styles.page}>
      <div className={styles.layout}>
        <section className={styles.panel} aria-labelledby="mycart-h">
          <h1 id="mycart-h" className={styles.h1}>
            {t('My cart')}
          </h1>
          <ul className={styles.lines} aria-busy={isUpdating}>
            {cart.lines.map((l) => (
              <Line key={l.offerId} line={l} onQuantity={(q) => setQuantity(l.offerId, q)} onRemove={() => remove(l.offerId)} />
            ))}
          </ul>
        </section>

        <aside className={styles.summary} aria-labelledby="summary-h">
          <h2 id="summary-h" className={styles.h2}>
            {t('Summary')}
          </h2>
          <button type="button" className={styles.checkout} disabled={!canCheckout} onClick={() => navigate('/checkout')}>
            {signedIn ? t('Proceed to checkout') : t('Log in and checkout')}
          </button>
          {unavailable.length > 0 && (
            <p className={styles.warning} role="alert">
              {t('Some items are sold out or exceed the seller’s stock. Remove them or lower the quantity to continue.')}
            </p>
          )}
          <dl className={styles.totals}>
            <dt>{cart.count === 1 ? t('1 product') : t('{n} products', { n: cart.count })}</dt>
            <dd>{money(cart.totalCents)}</dd>
            <dt>{t('Service fee')}</dt>
            <dd>{money(0)}</dd>
            <dt className={styles.totalLabel}>{t('Total:')}</dt>
            <dd className={styles.total}>{money(cart.totalCents)}</dd>
          </dl>
          {converted && <p className={styles.note}>{t('Charged in EUR: {amount}', { amount: eur(cart.totalCents) })}</p>}
          <p className={styles.note}>
            <ShieldCheck size={16} aria-hidden="true" />{' '}
            {t('Demo shop: payment is simulated and no real money is charged. Prices are checked again at checkout.')}
          </p>
        </aside>
      </div>
      <Recommendations exclude={cart.lines.map((l) => l.product.slug)} />
    </Container>
  )
}

/** "Inspired by your picks": popular products from the API that aren't already in the cart. */
function Recommendations({ exclude }: { exclude: string[] }) {
  const { t } = useI18n()
  const { data, isPending } = useProducts('sort=popular&page_size=12')
  const items = (data?.items ?? []).filter((p) => !exclude.includes(p.slug) && p.minPriceCents !== null).slice(0, 10)
  if (!isPending && items.length === 0) return null
  return (
    <section className={styles.recs} aria-labelledby="recs-h">
      <h2 id="recs-h" className={styles.recsH}>
        {t('Inspired by your picks')}
      </h2>
      <ProductRow products={items} loading={isPending} />
    </section>
  )
}

function Line({ line: l, onQuantity, onRemove }: { line: CartLine; onQuantity: (q: number) => void; onRemove: () => void }) {
  const max = Math.min(MAX_QUANTITY, Math.max(l.stock, 1))
  const device = useDevice()
  const verdict = device ? verdictFor(device, l.product) : null
  const { t, money } = useI18n()
  return (
    <li className={l.available ? styles.line : `${styles.line} ${styles.lineUnavailable}`}>
      <Link to={`/p/${l.product.slug}`} className={styles.thumb} tabIndex={-1} aria-hidden="true">
        <img referrerPolicy="no-referrer" src={l.product.coverUrl} alt="" width={90} height={127} />
      </Link>
      <div className={styles.info}>
        <span className={styles.soldBy}>
          {t('Sold by')} <strong>{l.seller.name}</strong>
        </span>
        <Link to={`/p/${l.product.slug}`} className={styles.title}>
          {l.product.title}
        </Link>
        <span className={styles.digital}>{t('Digital product')}</span>
        {!l.available ? (
          <span className={styles.stockWarning}>{t('No longer available from this seller')}</span>
        ) : (
          l.quantity > l.stock && <span className={styles.stockWarning}>{t('Only {n} left', { n: l.stock })}</span>
        )}
        {verdict?.status === 'no' && (
          <span className={styles.compatWarning} role="note">
            ⚠ {t('Won’t work for you: {parts}.', { parts: verdict.failing.map((f) => t(PART_LABEL[f])).join(', ') })}{' '}
            <Link to={`/store?q=${encodeURIComponent(l.product.title.split(/[(:]/)[0]?.trim() ?? '')}`}>{t('Find another version')}</Link>
            <ProposalNote id="cart" inline />
          </span>
        )}
        <div className={styles.controls}>
          <div className={styles.qty} role="group" aria-label={t('Quantity for {title}', { title: l.product.title })}>
            <button type="button" aria-label={t('Decrease quantity')} disabled={l.quantity <= 1} onClick={() => onQuantity(l.quantity - 1)}>
              <Minus size={14} />
            </button>
            <span aria-live="polite">{l.quantity}</span>
            <button type="button" aria-label={t('Increase quantity')} disabled={l.quantity >= max || !l.available} onClick={() => onQuantity(l.quantity + 1)}>
              <Plus size={14} />
            </button>
          </div>
          <button type="button" className={styles.remove} aria-label={t('Remove {title}', { title: l.product.title })} onClick={onRemove}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <span className={styles.price}>{money(l.priceCents * l.quantity)}</span>
    </li>
  )
}
