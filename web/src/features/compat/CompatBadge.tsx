import { CircleCheck, CircleHelp, CircleX } from 'lucide-react'
import type { ProductCard } from '../../api/types'
import { useI18n } from '../../i18n/useI18n'
import { useDevice } from './useDevice'
import { PART_LABEL, verdictFor } from './verdict'
import styles from './WillItWork.module.css'

/** "Works for you" / "Won't work" marker for a product, once the visitor saved a setup. */
export function CompatBadge({ product, compact = false }: { product: Pick<ProductCard, 'platform' | 'region' | 'reqMin'> & { type?: ProductCard['type'] }; compact?: boolean }) {
  const device = useDevice()
  const { t } = useI18n()
  if (!device) return compact ? <span className={styles.badgeUnknown}>{t('Set up your device to check')}</span> : null
  const v = verdictFor(device, product)
  if (v.status === 'works')
    return (
      <span className={styles.badgeOk}>
        <CircleCheck size={14} aria-hidden="true" /> {t('Works for you')}
      </span>
    )
  if (v.status === 'unknown')
    return (
      <span className={styles.badgeUnknown}>
        <CircleHelp size={14} aria-hidden="true" />{' '}
        {v.unknownReason === 'data' ? t('Can’t check: requirements unclear') : t('Add your PC details to check')}
      </span>
    )
  const parts = v.failing.map((f) => t(PART_LABEL[f])).join(', ')
  return (
    <span className={styles.badgeNo} title={parts}>
      <CircleX size={14} aria-hidden="true" /> {compact ? t('Won’t work: {parts}', { parts }) : t('Won’t work for you')}
    </span>
  )
}
