import { useQuery } from '@tanstack/react-query'
import { BadgeCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { ApiError, api } from '../../api/client'
import type { ProductCard as Card } from '../../api/types'
import { Container } from '../../components/Container'
import { ProductCard, ProductCardSkeleton } from '../../components/ProductCard'
import { ErrorState } from '../../components/States'
import { useI18n } from '../../i18n/useI18n'
import { NotFoundPage } from '../not-found/NotFoundPage'
import { ratingLabel } from '../product/rating'
import styles from './SellerPage.module.css'

interface SellerData {
  slug: string
  name: string
  rating: number
  ratingCount: number
  verified: boolean
  products: Card[]
  total: number
  keysSold: number
  offerCount: number
}

/** Seller profile (Eneba's /vendor/<name>): rating, numbers and the products they sell. */
export function SellerPage() {
  const { slug = '' } = useParams()
  const [page, setPage] = useState(1)
  const { t, intl } = useI18n()
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['seller', slug, page],
    queryFn: ({ signal }) => api.get<SellerData>(`/sellers/${encodeURIComponent(slug)}?page=${page}`, { signal }),
    placeholderData: (prev) => prev,
  })
  useEffect(() => {
    if (data) document.title = `${data.name} — keyshop`
  }, [data])
  if (isError && error instanceof ApiError && error.status === 404) return <NotFoundPage />
  if (isError)
    return (
      <Container className={styles.page}>
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Container>
    )
  return (
    <Container className={styles.page}>
      {data ? (
        <header className={styles.head}>
          <span className={styles.logo} aria-hidden="true">
            {data.name.slice(0, 1)}
          </span>
          <div>
            <h1 className={styles.h1}>
              {data.name} {data.verified && <BadgeCheck size={22} className={styles.verified} aria-label={t('Verified seller')} />}
            </h1>
            <p className={styles.rating}>
              <strong>{data.rating.toFixed(2)}</strong> {t(ratingLabel(data.rating))} ·{' '}
              {t('{n} reviews', { n: data.ratingCount.toLocaleString(intl) })}
            </p>
          </div>
          <dl className={styles.stats}>
            <div>
              <dt>{t('Active offers')}</dt>
              <dd>{data.offerCount}</dd>
            </div>
            <div>
              <dt>{t('Keys sold here')}</dt>
              <dd>{data.keysSold}</dd>
            </div>
          </dl>
        </header>
      ) : (
        <div className={styles.head} aria-busy="true" />
      )}
      <p className={styles.note}>{t('Seller names and ratings are demo data.')}</p>
      <h2 className={styles.h2}>{data ? t('Products from this seller · {n}', { n: data.total }) : t('Products from this seller')}</h2>
      <div className={styles.grid}>
        {isPending ? Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />) : data?.products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
      {data && data.total > page * 24 && (
        <button type="button" className={styles.more} onClick={() => setPage((p) => p + 1)}>
          {t('Next page')}
        </button>
      )}
      {page > 1 && (
        <button type="button" className={styles.more} onClick={() => setPage((p) => p - 1)}>
          {t('Previous page')}
        </button>
      )}
    </Container>
  )
}
