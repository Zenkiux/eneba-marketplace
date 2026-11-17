import { Search, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { useSuggestions } from '../../api/catalog'
import { useI18n } from '../../i18n/useI18n'
import styles from './SearchBox.module.css'

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setV(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return v
}

/**
 * Global search (header, every page). Typing shows up to 6 typo-tolerant suggestions from the
 * API; Enter opens the full results in the store. Implements the ARIA combobox pattern so it
 * works with the keyboard and screen readers.
 */
export function SearchBox({ autoFocus = false, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { t, money } = useI18n()
  const [text, setText] = useState(() => (location.pathname === '/store' ? (params.get('q') ?? '') : ''))
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const debounced = useDebounced(text.trim(), 200)
  const { data, isFetching } = useSuggestions(debounced)
  const items = debounced.length >= 2 ? (data?.items ?? []) : []
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)

  // Keep the box in sync when the store's ?q= changes (back/forward navigation).
  const urlQ = location.pathname === '/store' ? (params.get('q') ?? '') : null
  const [lastUrlQ, setLastUrlQ] = useState(urlQ)
  if (urlQ !== lastUrlQ) {
    setLastUrlQ(urlQ)
    if (urlQ !== null) setText(urlQ)
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function goToResults() {
    const q = text.trim()
    setOpen(false)
    onDone?.()
    navigate(q ? `/store?q=${encodeURIComponent(q)}` : '/store')
  }

  function goToProduct(slug: string) {
    setOpen(false)
    onDone?.()
    navigate(`/p/${slug}`)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && items.length) {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % items.length)
    } else if (e.key === 'ArrowUp' && items.length) {
      e.preventDefault()
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  const showList = open && items.length > 0
  return (
    <div className={styles.wrap} ref={wrapRef}>
      <form
        role="search"
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault()
          const chosen = active >= 0 ? items[active] : undefined
          if (showList && chosen) goToProduct(chosen.slug)
          else goToResults()
        }}
      >
        <Search className={styles.icon} size={22} aria-hidden="true" />
        <input
          className={styles.input}
          type="search"
          name="q"
          value={text}
          autoFocus={autoFocus}
          autoComplete="off"
          maxLength={100}
          placeholder={t('Search for games, gift cards and more')}
          aria-label={t('Search products')}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {text && (
          <button type="button" className={styles.clear} aria-label={t('Clear search')} onClick={() => setText('')}>
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </form>
      {showList && (
        <ul id={listId} role="listbox" className={styles.list} aria-label={t('Suggestions')} aria-busy={isFetching}>
          {items.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? `${styles.option} ${styles.active}` : styles.option}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                goToProduct(p.slug)
              }}
            >
              <img referrerPolicy="no-referrer" src={p.coverUrl} alt="" width={36} height={54} />
              <span className={styles.optTitle}>{p.title}</span>
              <span className={styles.optPrice}>
                {p.minPriceCents === null ? t('Sold out') : money(p.minPriceCents)}
              </span>
            </li>
          ))}
          <li role="presentation" className={styles.all}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                goToResults()
              }}
            >
              {t('See all results for “{q}”', { q: text.trim() })}
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
