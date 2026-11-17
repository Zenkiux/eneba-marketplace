// Response shapes of the Go API (see docs/architecture.md → API summary).

export interface Named {
  slug: string
  name: string
}

export interface ProductCard {
  id: number
  slug: string
  title: string
  coverUrl: string
  platform: Named
  region: Named
  type: Named
  releaseDate: string | null
  listPriceCents: number
  /** Cheapest in-stock offer; null when every offer is sold out. */
  minPriceCents: number | null
  discountPercent: number
  offerCount: number
}

export interface FacetValue extends Named {
  count: number
}

export interface ProductPage {
  items: ProductCard[]
  total: number
  page: number
  pageSize: number
  sort: string
  facets: { platforms: FacetValue[]; regions: FacetValue[]; types: FacetValue[] }
}

export interface Seller {
  slug: string
  name: string
  rating: number
  ratingCount: number
  verified: boolean
}

export interface Offer {
  id: number
  priceCents: number
  currency: string
  stock: number
  seller: Seller
}

export interface ProductDetail extends ProductCard {
  description: string
  developer: string
  publisher: string
  genres: string[]
  offers: Offer[]
}

export interface HomeSectionRef {
  key: string
  type: string
  title: string
}

export interface HomeSection<T = unknown> extends HomeSectionRef {
  content: T
}

export interface Banner {
  slot: 'main' | 'side'
  title: string
  subtitle: string
  imageUrl: string
  ctaLabel: string
  ctaHref: string
}

export interface Category {
  kind: 'type' | 'platform'
  slug: string
  name: string
  count: number
}
