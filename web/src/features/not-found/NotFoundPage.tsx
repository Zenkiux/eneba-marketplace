import { useEffect } from 'react'
import { Link } from 'react-router'
import { Container } from '../../components/Container'
import { useI18n } from '../../i18n/useI18n'
import styles from './NotFoundPage.module.css'

/** Eneba-style 404: oversized playful headline, one line of copy, outlined button. */
export function NotFoundPage() {
  const { t } = useI18n()
  useEffect(() => {
    document.title = t('Page not found — keyshop')
  }, [t])
  return (
    <Container className={styles.page}>
      <h1 className={styles.title}>{t('Level not found! 404')}</h1>
      <p className={styles.text}>{t('This page doesn’t exist — maybe it was moved, or the link has a typo.')}</p>
      <Link to="/store" className={styles.button}>
        {t('Continue browsing')}
      </Link>
      <div className={styles.sprites} aria-hidden="true">
        {['--color-region', '--color-region-alt', '--color-cta', '--color-text-muted'].map((c, i) => (
          <svg key={c} className={styles.sprite} style={{ color: `var(${c})`, animationDelay: `${i * 0.4}s` }} width="56" height="64" viewBox="0 0 14 16">
            <path fill="currentColor" d="M4 0h6v1h2v2h1v2h1v11h-2v-1h-2v1H8v-2H6v2H4v-1H2v1H0V5h1V3h1V1h2z" />
            <path fill="var(--color-bg-page)" d="M3 5h3v4H3zM8 5h3v4H8z" />
            <path fill="var(--color-bg-panel)" d="M4 7h2v2H4zM9 7h2v2H9z" />
          </svg>
        ))}
      </div>
    </Container>
  )
}
