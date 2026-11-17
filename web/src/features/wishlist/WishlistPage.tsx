import { useEffect } from 'react'
import { Link } from 'react-router'
import { useWishlist } from '../../api/account'
import { Container } from '../../components/Container'
import { ProductCard, ProductCardSkeleton } from '../../components/ProductCard'
import { EmptyState, ErrorState } from '../../components/States'
import { useI18n } from '../../i18n/useI18n'
import styles from './Wishlist.module.css'

/** Eneba's "Favorites" (/wishlist): saved products as cards with live prices. */
export function WishlistPage() {
  const { data, isPending, isError, error, refetch } = useWishlist()
  const { t } = useI18n()
  useEffect(() => {
    document.title = t('Favorites — keyshop')
  }, [t])
  return (
    <Container className={styles.page}>
      <h1 className={styles.h1}>
        {t('Favorites')} {data && <span className={styles.count}>{data.items.length}</span>}
      </h1>
      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className={styles.grid}>
          {Array.from({ length: 5 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState title={t('No favorites yet')}>
          <p>{t('Tap the heart on any product to save it here and keep an eye on its price.')}</p>
          <Link to="/store" className={styles.cta}>
            {t('Browse the store')}
          </Link>
        </EmptyState>
      ) : (
        <div className={styles.grid}>
          {data.items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </Container>
  )
}
