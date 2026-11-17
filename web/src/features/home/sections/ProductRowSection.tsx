import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { useHomeSection } from '../../../api/catalog'
import { useI18n } from '../../../i18n/useI18n'
import { useViewed } from '../../product/viewed'
import type { ProductCard } from '../../../api/types'
import { Container } from '../../../components/Container'
import { ProductRow } from '../../../components/ProductRow'
import { ErrorState } from '../../../components/States'
import styles from './sections.module.css'
import type { SectionProps } from './registry'

/** Any product-row block (best sellers, deals, new releases, upcoming): content from the API. */
export function ProductRowSection({ sectionKey, title }: SectionProps) {
  return <Row sectionKey={sectionKey} title={title} />
}

/** "Recently viewed" and "Recommended for you": the API gets the slugs this browser viewed. */
export function ViewedRowSection({ sectionKey, title }: SectionProps) {
  const viewed = useViewed()
  return <Row sectionKey={sectionKey} title={title} viewed={viewed} />
}

function Row({ sectionKey, title, viewed }: SectionProps & { viewed?: string[] }) {
  const { data, isPending, isError, error, refetch } = useHomeSection<{ products: ProductCard[] }>(sectionKey, viewed)
  const { t } = useI18n()
  const products = data?.content.products ?? []
  if (!isPending && !isError && products.length === 0) return null
  return (
    <section className={styles.section} aria-labelledby={`h-${sectionKey}`}>
      <Container>
        <div className={styles.headRow}>
          <h2 id={`h-${sectionKey}`} className={styles.heading}>
            {data?.title ?? title}
          </h2>
          {data?.more && (
            <Link to={data.more} className={styles.more}>
              {t('See all')} <ChevronRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
        {isError ? <ErrorState compact error={error} onRetry={() => void refetch()} /> : <ProductRow products={products} loading={isPending} />}
      </Container>
    </section>
  )
}
