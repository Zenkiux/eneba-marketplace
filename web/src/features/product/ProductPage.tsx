import { BadgeCheck, CalendarDays, CircleCheck, KeyRound, Monitor, ShieldCheck } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { useProduct } from '../../api/catalog'
import type { Offer, ProductDetail } from '../../api/types'
import { Container } from '../../components/Container'
import { ErrorState } from '../../components/States'
import { formatCents } from '../../lib/money'
import { useCart } from '../cart/useCart'
import { NotFoundPage } from '../not-found/NotFoundPage'
import { ratingLabel } from './rating'
import styles from './ProductPage.module.css'

export function ProductPage() {
  const { slug = '' } = useParams()
  const { data: p, isPending, isError, error, refetch } = useProduct(slug)

  useEffect(() => {
    if (p) document.title = `${p.title} — keyshop`
  }, [p])

  if (isError && error instanceof ApiError && error.status === 404) return <NotFoundPage />
  if (isError) {
    return (
      <Container className={styles.page}>
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Container>
    )
  }
  if (isPending) return <Container className={`${styles.page} ${styles.loading}`}><div aria-busy="true" /></Container>
  return <Product p={p} />
}

function Product({ p }: { p: ProductDetail }) {
  const inStock = p.offers.filter((o) => o.stock > 0)
  const featured = inStock[0]
  return (
    <Container className={styles.page}>
      <nav aria-label="Breadcrumb" className={styles.crumbs}>
        <Link to="/store">Store</Link>
        <span aria-hidden="true">›</span>
        <Link to={`/store?type=${p.type.slug}`}>{p.type.name}</Link>
        <span aria-hidden="true">›</span>
        <Link to={`/store?platform=${p.platform.slug}`}>{p.platform.name}</Link>
        <span aria-hidden="true">›</span>
        <span className={styles.crumbCurrent}>{p.title}</span>
      </nav>

      <div className={styles.top}>
        <img className={styles.cover} src={p.coverUrl} alt={`${p.title} cover`} width={200} height={300} />
        <div className={styles.summary}>
          <h1 className={styles.h1}>{p.title}</h1>
          <ul className={styles.facts}>
            <li>
              <CircleCheck className={styles.factIconOk} size={34} strokeWidth={1.5} aria-hidden="true" />
              <div>
                <strong>{p.region.name}</strong>
                <span>Can be activated in: {p.region.slug === 'global' ? 'all countries' : p.region.name}</span>
              </div>
            </li>
            <li>
              <Monitor className={styles.factIcon} size={34} strokeWidth={1.5} aria-hidden="true" />
              <div>
                <strong>{p.platform.name}</strong>
                <span>Redeem the key in your {p.platform.name} account</span>
              </div>
            </li>
            <li>
              <KeyRound className={styles.factIcon} size={34} strokeWidth={1.5} aria-hidden="true" />
              <div>
                <strong>Digital key</strong>
                <span>This is a digital edition of the product (CD-KEY)</span>
                <span className={styles.positive}>Instant delivery after payment</span>
              </div>
            </li>
            {p.releaseDate && (
              <li>
                <CalendarDays className={styles.factIcon} size={34} strokeWidth={1.5} aria-hidden="true" />
                <div>
                  <strong>{isUpcoming(p.releaseDate) ? 'Pre-order' : 'Released'}</strong>
                  <span>{formatDate(p.releaseDate)}</span>
                </div>
              </li>
            )}
          </ul>
        </div>

        <aside className={styles.featured} aria-label="Featured offer">
          {featured ? (
            <>
              <span className={styles.featuredLabel}>Featured offer</span>
              {p.listPriceCents > featured.priceCents && (
                <span className={styles.was}>
                  <s>{formatCents(p.listPriceCents)}</s>{' '}
                  <span className={styles.positive}>-{Math.floor(((p.listPriceCents - featured.priceCents) * 100) / p.listPriceCents)}%</span>
                </span>
              )}
              <span className={styles.bigPrice}>{formatCents(featured.priceCents, featured.currency)}</span>
              <span className={styles.featuredSeller}>
                Sold by <strong>{featured.seller.name}</strong> · {featured.seller.rating.toFixed(2)} {ratingLabel(featured.seller.rating)}
              </span>
              <OfferButtons offer={featured} productTitle={p.title} big />
              {p.offers.length > 1 && (
                <a href="#offers" className={styles.moreOffers}>
                  +{p.offers.length - 1} {p.offers.length - 1 === 1 ? 'offer' : 'offers'} from other sellers
                </a>
              )}
            </>
          ) : (
            <>
              <span className={styles.featuredLabel}>Sold out</span>
              <p className={styles.soldOutText}>Every seller is currently out of keys for this product.</p>
            </>
          )}
          <p className={styles.safe}>
            <ShieldCheck size={18} aria-hidden="true" /> Demo checkout — no real money is charged
          </p>
        </aside>
      </div>

      <section id="offers" className={styles.section} aria-labelledby="offers-h">
        <h2 id="offers-h" className={styles.h2}>
          {p.offers.length} {p.offers.length === 1 ? 'offer' : 'offers'}
        </h2>
        <p className={styles.sectionNote}>Compare sellers and choose the offer you want. Seller names and ratings are demo data.</p>
        <ul className={styles.offers}>
          {p.offers.map((o) => (
            <OfferRow key={o.id} offer={o} productTitle={p.title} listPriceCents={p.listPriceCents} />
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="details-h">
        <h2 id="details-h" className={styles.h2}>
          Product details
        </h2>
        <div className={styles.details}>
          <p className={styles.description}>{p.description}</p>
          <dl className={styles.meta}>
            <dt>Developer</dt>
            <dd>{p.developer}</dd>
            <dt>Publisher</dt>
            <dd>{p.publisher}</dd>
            {p.releaseDate && (
              <>
                <dt>Release date</dt>
                <dd>{formatDate(p.releaseDate)}</dd>
              </>
            )}
            <dt>Genres</dt>
            <dd>{p.genres.join(', ')}</dd>
            <dt>Platform</dt>
            <dd>{p.platform.name}</dd>
            <dt>Region</dt>
            <dd>{p.region.name}</dd>
          </dl>
        </div>
      </section>
    </Container>
  )
}

function OfferRow({ offer: o, productTitle, listPriceCents }: { offer: Offer; productTitle: string; listPriceCents: number }) {
  const discount = listPriceCents > o.priceCents ? Math.floor(((listPriceCents - o.priceCents) * 100) / listPriceCents) : 0
  return (
    <li className={o.stock > 0 ? styles.offer : `${styles.offer} ${styles.offerSoldOut}`}>
      <div className={styles.sellerCol}>
        <span className={styles.sellerName}>
          {o.seller.name}
          {o.seller.verified && <BadgeCheck size={16} className={styles.verified} aria-label="Verified seller" />}
        </span>
        <span className={styles.sellerRating}>
          <strong>{o.seller.rating.toFixed(2)}</strong> {ratingLabel(o.seller.rating)} rating · {o.seller.ratingCount.toLocaleString('en-IE')} reviews
        </span>
        <span className={styles.stock}>{o.stock > 0 ? `${o.stock} in stock` : 'Sold out'}</span>
      </div>
      <div className={styles.priceCol}>
        {discount > 0 && (
          <span className={styles.was}>
            <s>{formatCents(listPriceCents)}</s> <span className={styles.positive}>-{discount}%</span>
          </span>
        )}
        <span className={styles.rowPrice}>{formatCents(o.priceCents, o.currency)}</span>
      </div>
      <OfferButtons offer={o} productTitle={productTitle} />
    </li>
  )
}

/** "Buy now" adds this exact offer and opens the cart; "Add to cart" stays on the page. */
function OfferButtons({ offer, productTitle, big = false }: { offer: Offer; productTitle: string; big?: boolean }) {
  const { add } = useCart()
  const navigate = useNavigate()
  if (offer.stock === 0) {
    return (
      <button type="button" className={styles.buy} disabled>
        Sold out
      </button>
    )
  }
  const label = `${productTitle} from ${offer.seller.name}`
  return (
    <div className={big ? styles.buttonsBig : styles.buttons}>
      <button
        type="button"
        className={styles.buy}
        aria-label={`Buy now: ${label}`}
        onClick={() => {
          add(offer.id, 1, offer.stock)
          navigate('/cart')
        }}
      >
        Buy now
      </button>
      <button type="button" className={styles.addToCart} aria-label={`Add to cart: ${label}`} onClick={() => add(offer.id, 1, offer.stock, label)}>
        Add to cart
      </button>
    </div>
  )
}

function isUpcoming(date: string) {
  return date > new Date().toISOString().slice(0, 10)
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IE', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}
