import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useHomeSection } from '../../../api/catalog'
import type { Banner } from '../../../api/types'
import { useI18n } from '../../../i18n/useI18n'
import styles from './HeroBanner.module.css'
import type { SectionProps } from './registry'

const AUTO_ADVANCE_MS = 6000

/** Banner block: rotating main banners plus side tiles, all from the banners table. */
export function HeroBanner({ sectionKey }: SectionProps) {
  const { data, isPending, isError } = useHomeSection<{ banners: Banner[] }>(sectionKey)
  const banners = data?.content.banners ?? []
  const main = banners.filter((b) => b.slot === 'main')
  const side = banners.filter((b) => b.slot === 'side')
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const { t } = useI18n()

  useEffect(() => {
    if (main.length < 2 || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % main.length), AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [main.length, paused])

  if (isError) return null // a failing block must not break the rest of the page
  if (isPending) return <div className={`${styles.hero} ${styles.loading}`} aria-hidden="true" />

  const current = main[index % Math.max(main.length, 1)]
  return (
    <section className={styles.hero} aria-label={t('Promotions')} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {current && (
        <div className={styles.main}>
          <Link to={current.ctaHref} className={styles.tile}>
            <img referrerPolicy="no-referrer" src={current.imageUrl} alt={`${current.title}. ${current.subtitle}`} />
          </Link>
          {main.length > 1 && (
            <>
              <button type="button" className={`${styles.arrow} ${styles.prev}`} aria-label={t('Previous banner')} onClick={() => setIndex((i) => (i - 1 + main.length) % main.length)}>
                <ChevronLeft size={28} />
              </button>
              <button type="button" className={`${styles.arrow} ${styles.next}`} aria-label={t('Next banner')} onClick={() => setIndex((i) => (i + 1) % main.length)}>
                <ChevronRight size={28} />
              </button>
              <div className={styles.dots}>
                {main.map((b, i) => (
                  <button key={b.title} type="button" aria-label={t('Show banner {n}', { n: i + 1 })} aria-current={i === index} className={i === index ? styles.dotActive : styles.dot} onClick={() => setIndex(i)} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {side.map((b) => (
        <Link key={b.title} to={b.ctaHref} className={`${styles.tile} ${styles.side}`}>
          <img referrerPolicy="no-referrer" src={b.imageUrl} alt={`${b.title}. ${b.subtitle}`} loading="lazy" />
        </Link>
      ))}
    </section>
  )
}
