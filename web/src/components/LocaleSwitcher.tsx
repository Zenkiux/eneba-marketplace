import { useQueryClient } from '@tanstack/react-query'
import { Globe } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { CURRENCY_CODES, LANGUAGES, setLocale, type CurrencyCode, type Lang } from '../i18n/locale'
import { useI18n } from '../i18n/useI18n'
import styles from './LocaleSwitcher.module.css'

/** Eneba-style "English EU | EUR" button opening language and currency choices. */
export function LocaleSwitcher() {
  const { lang, currency, t } = useI18n()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ lang, currency })
  const qc = useQueryClient()
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  const label = LANGUAGES.find((l) => l.code === lang)?.short ?? 'English EU'

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={styles.button}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setDraft({ lang, currency })
          setOpen((o) => !o)
        }}
      >
        <Globe size={16} aria-hidden="true" /> {label} <span aria-hidden="true">|</span> {currency}
      </button>
      {open && (
        <div id={id} className={styles.panel} role="dialog" aria-label={t('Language and currency')}>
          <label>
            {t('Language')}
            <select value={draft.lang} onChange={(e) => setDraft((d) => ({ ...d, lang: e.target.value as Lang }))}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('Currency')}
            <select value={draft.currency} onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value as CurrencyCode }))}>
              {CURRENCY_CODES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <p className={styles.note}>{t('Prices in other currencies are approximate. Orders are charged in EUR.')}</p>
          <button
            type="button"
            className={styles.save}
            onClick={() => {
              const langChanged = draft.lang !== lang
              setLocale(draft)
              setOpen(false)
              if (langChanged) void qc.resetQueries({ queryKey: ['home'] })
            }}
          >
            {t('Save')}
          </button>
        </div>
      )}
    </div>
  )
}
