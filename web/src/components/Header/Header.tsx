import { Heart, Menu, Search, ShoppingCart, User, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router'
import { useMe } from '../../api/auth'
import { useCart } from '../../features/cart/useCart'
import { CatalogNotice, CatalogSwitch } from '../CatalogSwitch'
import { ProposalsMenu } from '../../features/proposal/ProposalsMenu'
import { SearchBox } from '../SearchBox'
import { LocaleSwitcher } from '../LocaleSwitcher'
import { useI18n } from '../../i18n/useI18n'
import { Logo } from './Logo'
import { UserMenu } from './UserMenu'
import styles from './Header.module.css'

// Site navigation (chrome, not page content): shortcuts into the store's filters.
const navLinks = [
  { to: '/store?type=game', label: 'Games' },
  { to: '/store?type=dlc', label: 'DLC' },
  { to: '/store?type=gift-card', label: 'Gift Cards' },
  { to: '/store?type=subscription', label: 'Subscriptions' },
  { to: '/store?type=software', label: 'Software' },
  { to: '/store?platform=steam', label: 'Steam' },
  { to: '/store?platform=xbox', label: 'Xbox' },
  { to: '/store?platform=psn', label: 'PlayStation' },
  { to: '/store?platform=nintendo', label: 'Nintendo' },
]

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { count } = useCart()
  const me = useMe()
  const { t } = useI18n()

  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <button
          type="button"
          className={`${styles.iconButton} ${styles.mobileOnly}`}
          aria-label={menuOpen ? t('Close menu') : t('Open menu')}
          aria-expanded={menuOpen}
          aria-controls="site-nav"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
        <Link to="/" className={styles.logo} aria-label={t('keyshop home')}>
          <Logo />
        </Link>
        <div className={styles.search}>
          <SearchBox />
        </div>
        <span className={styles.locale}>
          <LocaleSwitcher />
        </span>
        <span className={styles.topSwitch}>
          <CatalogSwitch />
        </span>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.mobileOnly}`}
            aria-label={t('Search')}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((o) => !o)}
          >
            <Search size={24} />
          </button>
          <Link to="/wishlist" className={styles.iconButton} aria-label={t('Favorites')}>
            <Heart size={24} />
          </Link>
          <Link to="/cart" className={`${styles.iconButton} ${styles.cart}`} aria-label={count === 1 ? t('Cart, 1 item') : t('Cart, {n} items', { n: count })}>
            <ShoppingCart size={24} />
            {count > 0 && <span className={styles.cartCount}>{count}</span>}
          </Link>
          {me.data ? (
            <UserMenu user={me.data} />
          ) : (
            <Link to="/login" className={styles.account}>
              <User size={24} aria-hidden="true" />
              <span className={styles.accountText}>
                {t('Log in')} <span aria-hidden="true">|</span> {t('Register')}
              </span>
            </Link>
          )}
        </div>
      </div>
      {searchOpen && (
        <div className={styles.mobileSearch}>
          <SearchBox autoFocus onDone={() => setSearchOpen(false)} />
        </div>
      )}
      <nav id="site-nav" className={menuOpen ? `${styles.nav} ${styles.navOpen}` : styles.nav} aria-label={t('Categories')}>
        <div className={styles.navInner}>
          <Link to="/store" className={styles.categories} onClick={() => setMenuOpen(false)}>
            <Menu size={22} aria-hidden="true" /> {t('All products')}
          </Link>
          {navLinks.map((l) => (
            <NavLink key={l.to} to={l.to} className={styles.navLink} onClick={() => setMenuOpen(false)}>
              {t(l.label)}
            </NavLink>
          ))}
          <Link to="/store?sort=discount" className={styles.promo} onClick={() => setMenuOpen(false)}>
            {t('Deals')}
          </Link>
          <Link to="/will-it-work" className={styles.willItWork} onClick={() => setMenuOpen(false)}>
            {t('Will it work for me?')}
          </Link>
          <span className={styles.mobileLocale}>
            <LocaleSwitcher />
          </span>
          <span className={styles.switches}>
            <ProposalsMenu onNavigate={() => setMenuOpen(false)} />
            <span className={styles.navCatalog}>
              <CatalogSwitch />
            </span>
          </span>
        </div>
      </nav>
      <CatalogNotice />
    </header>
  )
}
