import { Link } from 'react-router'
import type { ProductCard as Card } from '../../api/types'
import { formatCents } from '../../lib/money'
import styles from './ProductCard.module.css'

interface Props {
  product: Card
  /** Load the cover eagerly (first visible cards) instead of lazily. */
  eager?: boolean
}

/** Eneba-style product card: 2:3 cover with a platform strip, dark info panel, "From" price. */
export function ProductCard({ product: p, eager = false }: Props) {
  const soldOut = p.minPriceCents === null
  return (
    <Link to={`/p/${p.slug}`} className={styles.card} aria-label={p.title}>
      <div className={styles.cover}>
        <img src={p.coverUrl} alt="" loading={eager ? 'eager' : 'lazy'} width={225} height={337} />
        <span className={styles.strip}>{p.platform.name}</span>
      </div>
      <div className={styles.info}>
        <span className={styles.title}>{p.title}</span>
        <span className={p.region.slug === 'europe' ? styles.regionAlt : styles.region}>{p.region.name}</span>
        {soldOut ? (
          <span className={styles.soldOut}>Sold out</span>
        ) : (
          <>
            <span className={styles.from}>
              From
              {p.discountPercent > 0 && (
                <>
                  {' '}
                  <s>{formatCents(p.listPriceCents)}</s> <span className={styles.discount}>-{p.discountPercent}%</span>
                </>
              )}
            </span>
            <span className={styles.price}>{formatCents(p.minPriceCents ?? 0)}</span>
          </>
        )}
        <span className={styles.hoverCta} aria-hidden="true">
          View offers
        </span>
      </div>
    </Link>
  )
}

/** Same footprint as a card, shown while data loads so the layout doesn't jump. */
export function ProductCardSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={`${styles.cover} ${styles.skeleton}`} />
      <div className={styles.info}>
        <span className={`${styles.skeletonLine} ${styles.wide}`} />
        <span className={styles.skeletonLine} />
        <span className={`${styles.skeletonLine} ${styles.price}`} />
      </div>
    </div>
  )
}
