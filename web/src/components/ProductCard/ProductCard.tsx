import { Link } from 'react-router'
import type { ProductCard as Card } from '../../api/types'
import { CompatBadge } from '../../features/compat/CompatBadge'
import { useI18n } from '../../i18n/useI18n'
import styles from './ProductCard.module.css'

interface Props {
  product: Card
  /** Load the cover eagerly (first visible cards) instead of lazily. */
  eager?: boolean
}

/** Eneba-style product card: 2:3 cover with a platform strip, dark info panel, "From" price. */
export function ProductCard({ product: p, eager = false }: Props) {
  const soldOut = p.minPriceCents === null
  const { t, money } = useI18n()
  return (
    <Link to={`/p/${p.slug}`} className={styles.card} aria-label={p.title}>
      <div className={styles.cover}>
        <img src={p.coverUrl} alt="" loading={eager ? 'eager' : 'lazy'} width={225} height={337} referrerPolicy="no-referrer" />
        <span className={styles.strip}>{p.platform.name}</span>
      </div>
      <div className={styles.info}>
        <span className={styles.title}>{p.title}</span>
        <span className={p.region.slug === 'europe' ? styles.regionAlt : styles.region}>{p.region.name}</span>
        {soldOut ? (
          <span className={styles.soldOut}>{t('Sold out')}</span>
        ) : (
          <>
            <span className={styles.from}>
              {t('From')}
              {p.discountPercent > 0 && (
                <>
                  {' '}
                  <s>{money(p.listPriceCents)}</s> <span className={styles.discount}>-{p.discountPercent}%</span>
                </>
              )}
            </span>
            <span className={styles.price}>{money(p.minPriceCents ?? 0)}</span>
          </>
        )}
        <CompatBadge product={p} />
        <span className={styles.hoverCta} aria-hidden="true">
          {t('View offers')}
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
