import { describe, expect, it } from 'vitest'
import { eurosToCents, parseStoreParams, toApiQuery, toggle, toUrlParams } from './storeQuery'

describe('store URL state', () => {
  it('round-trips every filter through the URL', () => {
    const url = new URLSearchParams('q=star&platform=steam,gog&region=global&type=game&min_price=500&max_price=4000&sort=price_asc&page=3')
    const state = parseStoreParams(url)
    expect(state).toEqual({
      q: 'star', platform: ['steam', 'gog'], region: ['global'], type: ['game'],
      minPrice: 500, maxPrice: 4000, sort: 'price_asc', page: 3,
    })
    expect(parseStoreParams(toUrlParams(state))).toEqual(state)
  })

  it('uses relevance by default when searching, popularity otherwise, and omits defaults', () => {
    expect(parseStoreParams(new URLSearchParams('q=hollow')).sort).toBe('relevance')
    expect(parseStoreParams(new URLSearchParams('')).sort).toBe('popular')
    expect(toUrlParams(parseStoreParams(new URLSearchParams('q=hollow'))).toString()).toBe('q=hollow')
  })

  it('ignores junk values instead of sending them to the API', () => {
    const s = parseStoreParams(new URLSearchParams('page=-2&min_price=abc&platform=,,'))
    expect(s.page).toBe(1)
    expect(s.minPrice).toBeNull()
    expect(s.platform).toEqual([])
  })

  it('always sends sort and page size to the API', () => {
    const q = new URLSearchParams(toApiQuery(parseStoreParams(new URLSearchParams('region=europe'))))
    expect(q.get('sort')).toBe('popular')
    expect(q.get('page_size')).toBe('24')
    expect(q.get('region')).toBe('europe')
  })

  it('toggling a filter resets to page 1', () => {
    const s = parseStoreParams(new URLSearchParams('page=4&platform=steam'))
    expect(toggle(s, 'platform', 'steam')).toMatchObject({ platform: [], page: 1 })
    expect(toggle(s, 'platform', 'gog')).toMatchObject({ platform: ['steam', 'gog'], page: 1 })
  })

  it('converts euro input to cents', () => {
    expect(eurosToCents('12.5')).toBe(1250)
    expect(eurosToCents('12,99')).toBe(1299)
    expect(eurosToCents('')).toBeNull()
    expect(eurosToCents('1.999')).toBeUndefined()
    expect(eurosToCents('-3')).toBeUndefined()
  })
})
