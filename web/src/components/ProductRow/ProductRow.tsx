import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef } from 'react'
import type { ProductCard as Card } from '../../api/types'
import { ProductCard, ProductCardSkeleton } from '../ProductCard'
import { useI18n } from '../../i18n/useI18n'
import styles from './ProductRow.module.css'

/** Horizontal row of product cards with arrow buttons (scroll-snap on touch devices). */
export function ProductRow({ products, loading = false }: { products: Card[]; loading?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useI18n()
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' })
  return (
    <div className={styles.wrap}>
      <button type="button" className={`${styles.arrow} ${styles.left}`} aria-label={t('Scroll left')} onClick={() => scroll(-1)}>
        <ChevronLeft size={28} />
      </button>
      <div className={styles.row} ref={ref}>
        {loading
          ? Array.from({ length: 5 }, (_, i) => <ProductCardSkeleton key={i} />)
          : products.map((p, i) => <ProductCard key={p.id} product={p} eager={i < 5} />)}
      </div>
      <button type="button" className={`${styles.arrow} ${styles.right}`} aria-label={t('Scroll right')} onClick={() => scroll(1)}>
        <ChevronRight size={28} />
      </button>
    </div>
  )
}
