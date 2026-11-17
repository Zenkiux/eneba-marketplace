import { useQueryClient } from '@tanstack/react-query'
import { setCatalog } from '../api/catalogChoice'
import { useCatalogChoice } from '../api/useCatalogChoice'
import { useCatalogs } from '../api/catalog'
import { useI18n } from '../i18n/useI18n'
import styles from './CatalogSwitch.module.css'

// Data that depends on the selected catalog; it is dropped and refetched when the switch flips.
const CATALOG_QUERIES = new Set(['products', 'product', 'suggest', 'home'])

/** Toggle between our demo catalog and the optional eneba.com snapshot (only if it was imported). */
export function CatalogSwitch() {
  const choice = useCatalogChoice()
  const qc = useQueryClient()
  const { data } = useCatalogs()
  const { t } = useI18n()
  if (!data?.catalogs.some((c) => c.key === 'eneba')) return null
  const on = choice === 'eneba'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={styles.switch}
      onClick={() => {
        setCatalog(on ? 'demo' : 'eneba')
        void qc.resetQueries({ predicate: (q) => CATALOG_QUERIES.has(String(q.queryKey[0])) })
      }}
    >
      <span className={on ? `${styles.track} ${styles.trackOn}` : styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      {t('Eneba catalog')}
    </button>
  )
}

/** Shown while the snapshot is selected, so nobody mistakes it for the real shop. */
export function CatalogNotice() {
  const choice = useCatalogChoice()
  const { data } = useCatalogs()
  const { t } = useI18n()
  const snapshot = data?.catalogs.find((c) => c.key === 'eneba')
  if (choice !== 'eneba' || !snapshot) return null
  return (
    <div className={styles.notice} role="note">
      {snapshot.snapshotAt
        ? t('Showing a snapshot of eneba.com listings from {date}', { date: snapshot.snapshotAt })
        : t('Showing a snapshot of eneba.com listings')}{' '}
      {t('— real titles, covers and prices for demonstration only. Sellers are demo sellers, keys are fake and no real money is charged.')}
    </div>
  )
}
