import type { ReactNode } from 'react'
import { ApiError } from '../../api/client'
import { useI18n } from '../../i18n/useI18n'
import styles from './States.module.css'

export function ErrorState({ error, onRetry, compact = false }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const { t } = useI18n()
  const message =
    error instanceof ApiError && error.status === 0
      ? t('We could not reach the server. Check your connection and try again.')
      : error instanceof ApiError && error.status < 500
        ? error.message
        : t('Something went wrong while loading this.')
  return (
    <div className={compact ? styles.compact : styles.box} role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className={styles.outline} onClick={onRetry}>
          {t('Try again')}
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.box}>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </div>
  )
}
