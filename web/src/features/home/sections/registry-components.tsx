import { CategoryStrip } from './CategoryStrip'
import { HeroBanner } from './HeroBanner'
import { GenresSection } from './GenresSection'
import { ProductRowSection, ViewedRowSection } from './ProductRowSection'
import { sectionComponents } from './registry'

// Block type (from the API) → component. The API decides which blocks exist, their order,
// titles and contents; this map only decides how each *type* looks. Unknown types are skipped.
Object.assign(sectionComponents, {
  banner: HeroBanner,
  category_strip: CategoryStrip,
  bestsellers: ProductRowSection,
  deals: ProductRowSection,
  new_releases: ProductRowSection,
  upcoming: ProductRowSection,
  recently_viewed: ViewedRowSection,
  recommended: ViewedRowSection,
  genres: GenresSection,
})

export { sectionComponents }
