import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'
import styles from './StorePage.module.css'

function pagesToShow(page: number, count: number): (number | '…')[] {
  const set = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count))
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1]
    if (i > 0 && prev !== undefined && p - prev > 1) out.push('…')
    out.push(p)
  })
  return out
}

export function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (p: number) => void }) {
  const { t } = useI18n()
  const go = (p: number) => {
    onChange(p)
    window.scrollTo({ top: 0 })
  }
  return (
    <nav className={styles.pagination} aria-label={t('Pages')}>
      <button type="button" disabled={page <= 1} onClick={() => go(page - 1)} aria-label={t('Previous page')}>
        <ChevronLeft size={18} />
      </button>
      {pagesToShow(page, pageCount).map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className={styles.gap}>
            …
          </span>
        ) : (
          <button key={p} type="button" aria-current={p === page ? 'page' : undefined} className={p === page ? styles.current : undefined} onClick={() => go(p)}>
            {p}
          </button>
        ),
      )}
      <button type="button" disabled={page >= pageCount} onClick={() => go(page + 1)} aria-label={t('Next page')}>
        <ChevronRight size={18} />
      </button>
    </nav>
  )
}
