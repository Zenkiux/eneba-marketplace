import { ArrowDownWideNarrow, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useProducts } from '../../api/catalog'
import type { FacetValue } from '../../api/types'
import { Container } from '../../components/Container'
import { ProductCard, ProductCardSkeleton } from '../../components/ProductCard'
import { EmptyState, ErrorState } from '../../components/States'
import { FilterGroup } from './FilterGroup'
import { Pagination } from './Pagination'
import { PriceFilter } from './PriceFilter'
import { RELEVANCE, SORTS, parseStoreParams, toApiQuery, toggle, toUrlParams, type StoreState } from './storeQuery'
import styles from './StorePage.module.css'

export function StorePage() {
  const [params, setParams] = useSearchParams()
  const state = parseStoreParams(params)
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useProducts(toApiQuery(state))
  const [filtersOpen, setFiltersOpen] = useState(false)

  const update = (next: StoreState) => setParams(toUrlParams(next))
  const facetName = (facets: FacetValue[] | undefined, slug: string) => facets?.find((f) => f.slug === slug)?.name ?? slug

  useEffect(() => {
    document.title = state.q ? `“${state.q}” — keyshop` : 'Store — keyshop'
  }, [state.q])

  const chips = [
    ...state.type.map((v) => ({ label: facetName(data?.facets.types, v), remove: () => update(toggle(state, 'type', v)) })),
    ...state.platform.map((v) => ({ label: facetName(data?.facets.platforms, v), remove: () => update(toggle(state, 'platform', v)) })),
    ...state.region.map((v) => ({ label: facetName(data?.facets.regions, v), remove: () => update(toggle(state, 'region', v)) })),
    ...(state.minPrice !== null || state.maxPrice !== null
      ? [{ label: 'Price', remove: () => update({ ...state, minPrice: null, maxPrice: null, page: 1 }) }]
      : []),
  ]
  const sorts = state.q ? [RELEVANCE, ...SORTS] : SORTS
  const heading = state.q ? `Results for “${state.q}”` : 'Buy digital game keys at the best price'

  return (
    <Container className={styles.page}>
      <nav aria-label="Breadcrumb" className={styles.crumbs}>
        <Link to="/">Home</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <Link to="/store">Store</Link>
        {state.q && (
          <>
            <ChevronRight size={14} aria-hidden="true" />
            <span>Search</span>
          </>
        )}
      </nav>
      <h1 className={styles.h1}>{heading}</h1>

      <div className={styles.layout}>
        <aside className={filtersOpen ? `${styles.filters} ${styles.filtersOpen}` : styles.filters} aria-label="Filters">
          <div className={styles.filtersHead}>
            <span>Filters</span>
            <button type="button" className={styles.closeFilters} aria-label="Close filters" onClick={() => setFiltersOpen(false)}>
              <X size={22} />
            </button>
          </div>
          <PriceFilter
            min={state.minPrice}
            max={state.maxPrice}
            onApply={(minPrice, maxPrice) => update({ ...state, minPrice, maxPrice, page: 1 })}
          />
          <FilterGroup title="Type" values={data?.facets.types} selected={state.type} onToggle={(v) => update(toggle(state, 'type', v))} />
          <FilterGroup title="Platforms" values={data?.facets.platforms} selected={state.platform} onToggle={(v) => update(toggle(state, 'platform', v))} />
          <FilterGroup title="Regions" values={data?.facets.regions} selected={state.region} onToggle={(v) => update(toggle(state, 'region', v))} />
          <button type="button" className={styles.showResults} onClick={() => setFiltersOpen(false)}>
            Show {data?.total ?? ''} results
          </button>
        </aside>

        <section className={styles.results} aria-busy={isPending || isPlaceholderData}>
          <div className={styles.chips}>
            <button type="button" className={styles.filtersButton} onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal size={16} aria-hidden="true" /> Filters
            </button>
            {chips.map((c) => (
              <button key={c.label} type="button" className={styles.chip} onClick={c.remove} aria-label={`Remove filter ${c.label}`}>
                {c.label} <X size={14} aria-hidden="true" />
              </button>
            ))}
            {chips.length > 0 && (
              <button type="button" className={styles.clear} onClick={() => update({ ...parseStoreParams(new URLSearchParams()), q: state.q, sort: state.sort })}>
                Clear all
              </button>
            )}
          </div>

          <div className={styles.toolbar}>
            <p className={styles.count} aria-live="polite">
              Results found: <strong>{data ? data.total : '…'}</strong>
            </p>
            <label className={styles.sort}>
              <ArrowDownWideNarrow size={22} aria-hidden="true" />
              <span className="visuallyHidden">Sort by</span>
              <select value={state.sort} onChange={(e) => update({ ...state, sort: e.target.value, page: 1 })}>
                {sorts.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {isError ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : data && data.total === 0 ? (
            <EmptyState title="No products match">
              <p>{state.q ? 'Check the spelling or try a shorter name.' : 'Try removing a filter.'}</p>
              {chips.length > 0 && (
                <button type="button" className={styles.clear} onClick={() => update({ ...parseStoreParams(new URLSearchParams()), q: state.q })}>
                  Clear all filters
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
