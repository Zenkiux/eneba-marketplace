import { ArrowDownWideNarrow, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useProducts } from '../../api/catalog'
import type { FacetValue } from '../../api/types'
import { Container } from '../../components/Container'
import { worksParams } from '../compat/device'
import { useDevice } from '../compat/useDevice'
import { ProposalNote } from '../proposal/ProposalNote'
import { ProductCard, ProductCardSkeleton } from '../../components/ProductCard'
import { EmptyState, ErrorState } from '../../components/States'
import { useI18n } from '../../i18n/useI18n'
import { FilterGroup } from './FilterGroup'
import { Pagination } from './Pagination'
import { PriceFilter } from './PriceFilter'
import { RELEVANCE, SORTS, parseStoreParams, toApiQuery, toggle, toUrlParams, type StoreState } from './storeQuery'
import styles from './StorePage.module.css'

export function StorePage() {
  const [params, setParams] = useSearchParams()
  const state = parseStoreParams(params)
  const device = useDevice()
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useProducts(toApiQuery(state, device ? worksParams(device) : null))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { t } = useI18n()

  const update = (next: StoreState) => setParams(toUrlParams(next))
  const facetName = (facets: FacetValue[] | undefined, slug: string) => facets?.find((f) => f.slug === slug)?.name ?? slug

  useEffect(() => {
    document.title = state.q ? `“${state.q}” — keyshop` : t('Store — keyshop')
  }, [state.q, t])

  const chips = [
    ...state.type.map((v) => ({ label: facetName(data?.facets.types, v), remove: () => update(toggle(state, 'type', v)) })),
    ...state.platform.map((v) => ({ label: facetName(data?.facets.platforms, v), remove: () => update(toggle(state, 'platform', v)) })),
    ...state.region.map((v) => ({ label: facetName(data?.facets.regions, v), remove: () => update(toggle(state, 'region', v)) })),
    ...(state.works ? [{ label: t('Works for me'), remove: () => update({ ...state, works: false, page: 1 }) }] : []),
    ...(state.minPrice !== null || state.maxPrice !== null
      ? [{ label: t('Price'), remove: () => update({ ...state, minPrice: null, maxPrice: null, page: 1 }) }]
      : []),
  ]
  const sorts = state.q ? [RELEVANCE, ...SORTS] : SORTS
  const heading = state.q ? t('Results for “{q}”', { q: state.q }) : t('Buy digital game keys at the best price')

  return (
    <Container className={styles.page}>
      <nav aria-label={t('Breadcrumb')} className={styles.crumbs}>
        <Link to="/">{t('Home')}</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <Link to="/store">{t('Store')}</Link>
        {state.q && (
          <>
            <ChevronRight size={14} aria-hidden="true" />
            <span>{t('Search')}</span>
          </>
        )}
      </nav>
      <h1 className={styles.h1}>{heading}</h1>

      <div className={styles.layout}>
        <aside className={filtersOpen ? `${styles.filters} ${styles.filtersOpen}` : styles.filters} aria-label={t('Filters')}>
          <div className={styles.filtersHead}>
            <span>{t('Filters')}</span>
            <button type="button" className={styles.closeFilters} aria-label={t('Close filters')} onClick={() => setFiltersOpen(false)}>
              <X size={22} />
            </button>
          </div>
          <div className={styles.worksBox}>
            {device ? (
              <label className={styles.worksToggle}>
                <input type="checkbox" checked={state.works} onChange={() => update({ ...state, works: !state.works, page: 1 })} />
                <span>
                  <strong>{t('Works for me')}</strong>
                  <small>{t('Your region, platforms and PC')}</small>
                </span>
              </label>
            ) : (
              <Link to="/will-it-work" className={styles.worksSetup}>
                <strong>{t('Will it work for me?')}</strong>
                <small>{t('Set up your PC and consoles to filter')}</small>
              </Link>
            )}
            <ProposalNote id="filter" />
          </div>
          <PriceFilter
            min={state.minPrice}
            max={state.maxPrice}
            onApply={(minPrice, maxPrice) => update({ ...state, minPrice, maxPrice, page: 1 })}
          />
          <FilterGroup title={t('Type')} values={data?.facets.types} selected={state.type} onToggle={(v) => update(toggle(state, 'type', v))} />
          <FilterGroup title={t('Platforms')} values={data?.facets.platforms} selected={state.platform} onToggle={(v) => update(toggle(state, 'platform', v))} />
          <FilterGroup title={t('Regions')} values={data?.facets.regions} selected={state.region} onToggle={(v) => update(toggle(state, 'region', v))} />
          <button type="button" className={styles.showResults} onClick={() => setFiltersOpen(false)}>
            {data ? t('Show {n} results', { n: data.total }) : t('Show results')}
          </button>
        </aside>

        <section className={styles.results} aria-busy={isPending || isPlaceholderData}>
          <div className={styles.chips}>
            <button type="button" className={styles.filtersButton} onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal size={16} aria-hidden="true" /> {t('Filters')}
            </button>
            {chips.map((c) => (
              <button key={c.label} type="button" className={styles.chip} onClick={c.remove} aria-label={t('Remove filter {label}', { label: c.label })}>
                {c.label} <X size={14} aria-hidden="true" />
              </button>
            ))}
            {chips.length > 0 && (
              <button type="button" className={styles.clear} onClick={() => update({ ...parseStoreParams(new URLSearchParams()), q: state.q, sort: state.sort })}>
                {t('Clear all')}
              </button>
            )}
          </div>

          <div className={styles.toolbar}>
            <p className={styles.count} aria-live="polite">
              {t('Results found:')} <strong>{data ? data.total : '…'}</strong>
            </p>
            <label className={styles.sort}>
              <ArrowDownWideNarrow size={22} aria-hidden="true" />
              <span className="visuallyHidden">{t('Sort by')}</span>
              <select value={state.sort} onChange={(e) => update({ ...state, sort: e.target.value, page: 1 })}>
                {sorts.map((s) => (
                  <option key={s.value} value={s.value}>
                    {t(s.label)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {isError ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : data && data.total === 0 ? (
            <EmptyState title={t('No products match')}>
              <p>{state.q ? t('Check the spelling or try a shorter name.') : t('Try removing a filter.')}</p>
              {chips.length > 0 && (
                <button type="button" className={styles.clear} onClick={() => update({ ...parseStoreParams(new URLSearchParams()), q: state.q })}>
                  {t('Clear all filters')}
                </button>
              )}
            </EmptyState>
          ) : (
            <div className={isPlaceholderData ? `${styles.grid} ${styles.stale}` : styles.grid}>
              {isPending
                ? Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)
                : data.items.map((p, i) => <ProductCard key={p.id} product={p} eager={i < 8} />)}
            </div>
          )}

          {data && data.total > data.pageSize && (
            <Pagination page={state.page} pageCount={Math.ceil(data.total / data.pageSize)} onChange={(page) => update({ ...state, page })} />
          )}
        </section>
      </div>
    </Container>
  )
}
