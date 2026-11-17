import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { eurosToCents } from './storeQuery'
import styles from './StorePage.module.css'

const toText = (c: number | null) => (c === null ? '' : (c / 100).toString())

/** Price range in EUR. Applied on Enter, blur or the Apply button; sent to the API in cents. */
export function PriceFilter({ min, max, onApply }: { min: number | null; max: number | null; onApply: (min: number | null, max: number | null) => void }) {
  const [minText, setMinText] = useState(toText(min))
  const [maxText, setMaxText] = useState(toText(max))
  const [prev, setPrev] = useState({ min, max })
  const { t } = useI18n()
  if (prev.min !== min || prev.max !== max) {
    setPrev({ min, max })
    setMinText(toText(min))
    setMaxText(toText(max))
  }
  const minC = eurosToCents(minText)
  const maxC = eurosToCents(maxText)
  const invalid = minC === undefined || maxC === undefined || (minC !== null && maxC !== null && minC > maxC)
  const apply = () => {
    if (!invalid && (minC !== min || maxC !== max)) onApply(minC ?? null, maxC ?? null)
  }
  return (
    <fieldset className={styles.group}>
      <legend className={styles.groupLegend}>
        <span>{t('Price range (EUR)')}</span>
      </legend>
      <form
        className={styles.price}
        onSubmit={(e) => {
          e.preventDefault()
          apply()
        }}
      >
        <input inputMode="decimal" aria-label={t('Minimum price in euros')} placeholder={t('Min')} value={minText} onChange={(e) => setMinText(e.target.value)} onBlur={apply} aria-invalid={minC === undefined} />
        <span aria-hidden="true">–</span>
        <input inputMode="decimal" aria-label={t('Maximum price in euros')} placeholder={t('Max')} value={maxText} onChange={(e) => setMaxText(e.target.value)} onBlur={apply} aria-invalid={maxC === undefined} />
        <button type="submit" className={styles.applyPrice} disabled={invalid}>
          {t('Apply price')}
        </button>
      </form>
      {invalid && <p className={styles.priceError}>{t('Enter amounts like 9.99, with the minimum below the maximum.')}</p>}
    </fieldset>
  )
}
