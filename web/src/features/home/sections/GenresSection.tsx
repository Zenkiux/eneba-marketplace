import { Link } from 'react-router'
import { useHomeSection } from '../../../api/catalog'
import { Container } from '../../../components/Container'
import { ErrorState } from '../../../components/States'
import { useI18n } from '../../../i18n/useI18n'
import styles from './sections.module.css'
import type { SectionProps } from './registry'

/** Eneba's "Categories" block: genre tiles with product counts, each opening the filtered store. */
export function GenresSection({ sectionKey, title }: SectionProps) {
  const { data, isPending, isError, error, refetch } = useHomeSection<{ genres: { name: string; count: number }[] }>(sectionKey)
  const { t } = useI18n()
  const genres = data?.content.genres ?? []
  if (!isPending && !isError && genres.length === 0) return null
  return (
    <section className={styles.section} aria-labelledby={`h-${sectionKey}`}>
      <Container>
        <h2 id={`h-${sectionKey}`} className={styles.heading}>
          {data?.title ?? title}
        </h2>
        {isError ? (
          <ErrorState compact error={error} onRetry={() => void refetch()} />
        ) : (
          <ul className={styles.genres} aria-busy={isPending}>
            {genres.map((g) => (
              <li key={g.name}>
                <Link to={`/store?genre=${encodeURIComponent(g.name)}`} className={styles.genre}>
                  <span className={styles.genreCount}>{t('{n} products', { n: g.count })}</span>
                  <span className={styles.genreName}>{t(g.name)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  )
}
