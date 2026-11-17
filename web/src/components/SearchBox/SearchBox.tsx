import { Search, TrendingUp, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { useSuggestions, useTrending } from '../../api/catalog'
import type { ProductCard } from '../../api/types'
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
  const typing = debounced.length >= 2
  const trending = useTrending(open && !text.trim())
  // One keyboard-navigable list, like Eneba's: phrase completions, then products; trending
  // searches when the box is empty.
  type Opt = { kind: 'phrase'; text: string } | { kind: 'product'; product: ProductCard }
  const items: Opt[] = !text.trim()
    ? (trending.data?.items ?? []).map((q) => ({ kind: 'phrase' as const, text: q }))
    : typing
      ? [
          ...(data?.phrases ?? []).map((q) => ({ kind: 'phrase' as const, text: q })),
          ...(data?.items ?? []).map((p) => ({ kind: 'product' as const, product: p })),
        ]
      : []
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

  function goToResults(query?: string) {
    const q = (query ?? text).trim()
    if (query) setText(query)
    setOpen(false)
    onDone?.()
    navigate(q ? `/store?q=${encodeURIComponent(q)}` : '/store')
  }

  function goToProduct(slug: string) {
    setOpen(false)
    onDone?.()
    navigate(`/p/${slug}`)
  }

  function choose(o: Opt) {
    if (o.kind === 'product') goToProduct(o.product.slug)
    else goToResults(o.text)
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
          if (showList && chosen) choose(chosen)
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
          {!text.trim() && (
            <li role="presentation" className={styles.groupLabel}>
              {t('Trending searches')}
            </li>
          )}
          {items.map((o, i) => {
            const cls = i === active ? `${styles.option} ${styles.active}` : styles.option
            const common = {
              id: `${listId}-${i}`,
              role: 'option' as const,
              'aria-selected': i === active,
              onMouseEnter: () => setActive(i),
              onMouseDown: (e: React.MouseEvent) => {
                e.preventDefault()
                choose(o)
              },
            }
            if (o.kind === 'phrase') {
              return (
                <li key={`q-${o.text}`} {...common} className={`${cls} ${styles.phrase}`}>
                  {!text.trim() ? <TrendingUp size={16} aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
                  <span>{o.text}</span>
                </li>
              )
            }
            const p = o.product
            const discounted = p.minPriceCents !== null && p.listPriceCents > p.minPriceCents
            return (
              <li key={p.id} {...common} className={cls}>
                <img referrerPolicy="no-referrer" src={p.coverUrl} alt="" width={36} height={54} />
                <span className={styles.optText}>
                  <span className={styles.optKind}>
                    {t('Digital good')}
                    {p.type.slug !== 'game' && <strong>{p.type.name}</strong>}
                  </span>
                  <span className={styles.optTitle}>{p.title}</span>
                </span>
                <span className={styles.optPrice}>
                  {p.minPriceCents === null ? (
                    t('Sold out')
                  ) : (
                    <>
                      <small>{t('From')}</small>
                      {discounted && <s>{money(p.listPriceCents)}</s>}
                      {money(p.minPriceCents)}
                    </>
                  )}
                </span>
              </li>
            )
          })}
          {typing && (
            <li role="presentation" className={styles.all}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  goToResults()
                }}
              >
                {data?.total ? t('Show all {n} results', { n: data.total }) : t('See all results for “{q}”', { q: text.trim() })}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
