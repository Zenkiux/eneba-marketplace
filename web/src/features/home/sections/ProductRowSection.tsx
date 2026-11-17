import { useHomeSection } from '../../../api/catalog'
import type { ProductCard } from '../../../api/types'
import { Container } from '../../../components/Container'
import { ProductRow } from '../../../components/ProductRow'
import { ErrorState } from '../../../components/States'
import styles from './sections.module.css'
import type { SectionProps } from './registry'

/** Any product-row block (best sellers, deals, new releases, upcoming): content from the API. */
export function ProductRowSection({ sectionKey, title }: SectionProps) {
  const { data, isPending, isError, error, refetch } = useHomeSection<{ products: ProductCard[] }>(sectionKey)
  const products = data?.content.products ?? []
  if (!isPending && !isError && products.length === 0) return null
  return (
    <section className={styles.section} aria-labelledby={`h-${sectionKey}`}>
      <Container>
        <h2 id={`h-${sectionKey}`} className={styles.heading}>
          {data?.title ?? title}
        </h2>
        {isError ? <ErrorState compact error={error} onRetry={() => void refetch()} /> : <ProductRow products={products} loading={isPending} />}
      </Container>
    </section>
  )
}
