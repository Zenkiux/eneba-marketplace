import { Gamepad2, Gift, Layers, Monitor, Puzzle, Repeat, Tag, Tv } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { useHomeSection } from '../../../api/catalog'
import type { Category } from '../../../api/types'
import { Container } from '../../../components/Container'
import { useI18n } from '../../../i18n/useI18n'
import styles from './sections.module.css'
import type { SectionProps } from './registry'

// Presentation only: which icon to draw for a category slug. The categories themselves (and
// their counts) come from the API; an unknown slug gets the generic tag icon.
const icons: Record<string, LucideIcon> = {
  game: Gamepad2,
  dlc: Puzzle,
  'gift-card': Gift,
  subscription: Repeat,
  steam: Monitor,
  gog: Monitor,
  epic: Monitor,
  xbox: Tv,
  psn: Tv,
  nintendo: Layers,
}

export function CategoryStrip({ sectionKey }: SectionProps) {
  const { data, isError } = useHomeSection<{ categories: Category[] }>(sectionKey)
  const { t } = useI18n()
  if (isError || !data) return null
  return (
    <nav className={styles.strip} aria-label={t('Browse categories')}>
      <Container className={styles.stripInner}>
        {data.content.categories.map((c) => {
          const Icon = icons[c.slug] ?? Tag
          return (
            <Link key={`${c.kind}-${c.slug}`} to={`/store?${c.kind}=${encodeURIComponent(c.slug)}`} className={styles.category}>
              <Icon size={30} strokeWidth={1.6} aria-hidden="true" />
              <span>{c.name}</span>
            </Link>
          )
        })}
      </Container>
    </nav>
  )
}
