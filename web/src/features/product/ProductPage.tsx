import { BadgeCheck, CalendarDays, CircleCheck, KeyRound, Monitor, ShieldCheck } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { useProduct } from '../../api/catalog'
import type { Offer, ProductDetail } from '../../api/types'
import { Container } from '../../components/Container'
import { ErrorState } from '../../components/States'
import { useI18n } from '../../i18n/useI18n'
import { useCart } from '../cart/useCart'
import { ProductCompat } from '../compat/ProductCompat'
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
  const { t, money, intl } = useI18n()
  return (
    <Container className={styles.page}>
      <nav aria-label={t('Breadcrumb')} className={styles.crumbs}>
        <Link to="/store">{t('Store')}</Link>
        <span aria-hidden="true">›</span>
        <Link to={`/store?type=${p.type.slug}`}>{p.type.name}</Link>
        <span aria-hidden="true">›</span>
        <Link to={`/store?platform=${p.platform.slug}`}>{p.platform.name}</Link>
        <span aria-hidden="true">›</span>
        <span className={styles.crumbCurrent}>{p.title}</span>
      </nav>

      <div className={styles.top}>
        <img className={styles.cover} referrerPolicy="no-referrer" src={p.coverUrl} alt={t('{title} cover', { title: p.title })} width={200} height={300} />
        <div className={styles.summary}>
          <h1 className={styles.h1}>{p.title}</h1>
          <ul className={styles.facts}>
            <li>
              <CircleCheck className={styles.factIconOk} size={34} strokeWidth={1.5} aria-hidden="true" />
              <div>
                <strong>{p.region.name}</strong>
                <span>{t('Can be activated in: {where}', { where: p.region.slug === 'global' ? t('all countries') : p.region.name })}</span>
              </div>
            </li>
            <li>
              <Monitor className={styles.factIcon} size={34} strokeWidth={1.5} aria-hidden="true" />
              <div>
                <strong>{p.platform.name}</strong>
                <span>{t('Redeem the key in your {platform} account', { platform: p.platform.name })}</span>
              </div>
            </li>
            <li>
              <KeyRound className={styles.factIcon} size={34} strokeWidth={1.5} aria-hidden="true" />
              <div>
                <strong>{t('Digital key')}</strong>
                <span>{t('This is a digital edition of the product (CD-KEY)')}</span>
                <span className={styles.positive}>{t('Instant delivery after payment')}</span>
              </div>
            </li>
            {p.releaseDate && (
              <li>
                <CalendarDays className={styles.factIcon} size={34} strokeWidth={1.5} aria-hidden="true" />
                <div>
                  <strong>{isUpcoming(p.releaseDate) ? t('Pre-order') : t('Released')}</strong>
                  <span>{formatDate(p.releaseDate, intl)}</span>
                </div>
              </li>
            )}
          </ul>
        </div>

        <aside className={styles.featured} aria-label={t('Featured offer')}>
          {featured ? (
            <>
              <span className={styles.featuredLabel}>{t('Featured offer')}</span>
              {p.listPriceCents > featured.priceCents && (
                <span className={styles.was}>
                  <s>{money(p.listPriceCents)}</s>{' '}
                  <span className={styles.positive}>-{Math.floor(((p.listPriceCents - featured.priceCents) * 100) / p.listPriceCents)}%</span>
                </span>
              )}
              <span className={styles.bigPrice}>{money(featured.priceCents)}</span>
              <span className={styles.featuredSeller}>
                {t('Sold by')} <strong>{featured.seller.name}</strong> · {featured.seller.rating.toFixed(2)} {t(ratingLabel(featured.seller.rating))}
              </span>
              <OfferButtons offer={featured} productTitle={p.title} big />
              {p.offers.length > 1 && (
                <a href="#offers" className={styles.moreOffers}>
                  {p.offers.length - 1 === 1 ? t('+1 offer from other sellers') : t('+{n} offers from other sellers', { n: p.offers.length - 1 })}
                </a>
              )}
            </>
          ) : (
            <>
              <span className={styles.featuredLabel}>{t('Sold out')}</span>
              <p className={styles.soldOutText}>{t('Every seller is currently out of keys for this product.')}</p>
            </>
          )}
          <p className={styles.safe}>
            <ShieldCheck size={18} aria-hidden="true" /> {t('Demo checkout — no real money is charged')}
          </p>
        </aside>
      </div>

      <section id="offers" className={styles.section} aria-labelledby="offers-h">
        <h2 id="offers-h" className={styles.h2}>
          {p.offers.length === 1 ? t('1 offer') : t('{n} offers', { n: p.offers.length })}
        </h2>
        <p className={styles.sectionNote}>{t('Compare sellers and choose the offer you want. Seller names and ratings are demo data.')}</p>
        <ul className={styles.offers}>
          {p.offers.map((o) => (
            <OfferRow key={o.id} offer={o} productTitle={p.title} listPriceCents={p.listPriceCents} />
          ))}
        </ul>
      </section>

      <ProductCompat p={p} />

      <section className={styles.section} aria-labelledby="details-h">
        <h2 id="details-h" className={styles.h2}>
          {t('Product details')}
        </h2>
        <div className={styles.details}>
          <p className={styles.description}>{p.description}</p>
          <dl className={styles.meta}>
            <dt>{t('Developer')}</dt>
            <dd>{p.developer}</dd>
            <dt>{t('Publisher')}</dt>
            <dd>{p.publisher}</dd>
            {p.releaseDate && (
              <>
                <dt>{t('Release date')}</dt>
                <dd>{formatDate(p.releaseDate, intl)}</dd>
              </>
            )}
            <dt>{t('Genres')}</dt>
            <dd>{p.genres.join(', ')}</dd>
            <dt>{t('Platform')}</dt>
            <dd>{p.platform.name}</dd>
            <dt>{t('Region')}</dt>
            <dd>{p.region.name}</dd>
          </dl>
        </div>
      </section>
    </Container>
  )
}

function OfferRow({ offer: o, productTitle, listPriceCents }: { offer: Offer; productTitle: string; listPriceCents: number }) {
  const discount = listPriceCents > o.priceCents ? Math.floor(((listPriceCents - o.priceCents) * 100) / listPriceCents) : 0
  const { t, money, intl } = useI18n()
  return (
    <li className={o.stock > 0 ? styles.offer : `${styles.offer} ${styles.offerSoldOut}`}>
      <div className={styles.sellerCol}>
        <span className={styles.sellerName}>
          {o.seller.name}
          {o.seller.verified && <BadgeCheck size={16} className={styles.verified} aria-label={t('Verified seller')} />}
        </span>
        <span className={styles.sellerRating}>
          <strong>{o.seller.rating.toFixed(2)}</strong>{' '}
          {t('{label} rating · {n} reviews', { label: t(ratingLabel(o.seller.rating)), n: o.seller.ratingCount.toLocaleString(intl) })}
        </span>
        <span className={styles.stock}>{o.stock > 0 ? t('{n} in stock', { n: o.stock }) : t('Sold out')}</span>
      </div>
      <div className={styles.priceCol}>
        {discount > 0 && (
          <span className={styles.was}>
            <s>{money(listPriceCents)}</s> <span className={styles.positive}>-{discount}%</span>
          </span>
        )}
        <span className={styles.rowPrice}>{money(o.priceCents)}</span>
      </div>
      <OfferButtons offer={o} productTitle={productTitle} />
    </li>
  )
}

/** "Buy now" adds this exact offer and opens the cart; "Add to cart" stays on the page. */
function OfferButtons({ offer, productTitle, big = false }: { offer: Offer; productTitle: string; big?: boolean }) {
  const { add } = useCart()
  const navigate = useNavigate()
  const { t } = useI18n()
  if (offer.stock === 0) {
    return (
      <button type="button" className={styles.buy} disabled>
        {t('Sold out')}
      </button>
    )
  }
  const label = t('{title} from {seller}', { title: productTitle, seller: offer.seller.name })
  return (
    <div className={big ? styles.buttonsBig : styles.buttons}>
      <button
        type="button"
        className={styles.buy}
        aria-label={t('Buy now: {label}', { label })}
        onClick={() => {
          add(offer.id, 1, offer.stock)
          navigate('/cart')
        }}
      >
        {t('Buy now')}
      </button>
      <button type="button" className={styles.addToCart} aria-label={t('Add to cart: {label}', { label })} onClick={() => add(offer.id, 1, offer.stock, label)}>
        {t('Add to cart')}
      </button>
    </div>
  )
}

function isUpcoming(date: string) {
  return date > new Date().toISOString().slice(0, 10)
}

function formatDate(date: string, locale: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}
