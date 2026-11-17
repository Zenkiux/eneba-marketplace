import { ArrowLeft, ChevronDown, KeyRound, LifeBuoy, Menu, Receipt, Settings, User, Wallet, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { useMe } from '../../api/auth'
import { Logo } from '../../components/Header/Logo'
import { Toast } from '../../components/Toast'
import { useI18n } from '../../i18n/useI18n'
import { RequireAuth } from '../auth/RequireAuth'
import styles from './Account.module.css'

interface Group {
  label: string
  icon: LucideIcon
  to: string
  children?: { label: string; to: string }[]
}

// The sidebar of my.eneba.com, item for item.
const ACCOUNT_NAV: Group[] = [
  {
    label: 'My account',
    icon: User,
    to: '/account',
    children: [
      { label: 'Overview', to: '/account' },
      { label: 'Login history', to: '/account/login-history' },
    ],
  },
  {
    label: 'Balance',
    icon: Wallet,
    to: '/account/wallet',
    children: [
      { label: 'Wallet overview', to: '/account/wallet' },
      { label: 'Transactions', to: '/account/transactions' },
      { label: 'Cashback', to: '/account/cashback' },
      { label: 'Bonus', to: '/account/bonus' },
      { label: 'Redeem gift card', to: '/account/redeem-gift-card' },
      { label: 'Add funds', to: '/account/add-funds' },
    ],
  },
  { label: 'Orders', icon: Receipt, to: '/account/orders' },
  { label: 'Keys library', icon: KeyRound, to: '/account/library' },
  { label: 'Tickets', icon: LifeBuoy, to: '/account/tickets' },
  {
    label: 'Settings',
    icon: Settings,
    to: '/account/settings',
    children: [
      { label: 'My personal info', to: '/account/settings' },
      { label: 'Change password', to: '/account/password' },
      { label: 'Connected apps', to: '/account/connected-apps' },
      { label: 'Multi factor authentication', to: '/account/mfa' },
    ],
  },
]

function groupFor(pathname: string) {
  return ACCOUNT_NAV.find((g) => g.to === pathname || g.children?.some((c) => c.to === pathname))
}

/** my.eneba.com-style shell: purple top bar, purple sidebar, light content area. */
export function AccountLayout() {
  const { pathname } = useLocation()
  const me = useMe()
  const { t, money } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <button
          type="button"
          className={styles.menuToggle}
          aria-label={menuOpen ? t('Close menu') : t('Open menu')}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <Menu size={24} />
        </button>
        <Link to="/" className={styles.logo} aria-label={t('keyshop home')}>
          <Logo />
        </Link>
        <Link to="/" className={styles.back}>
          <ArrowLeft size={16} aria-hidden="true" /> {t('Back to store')}
        </Link>
        {me.data && (
          <span className={styles.who}>
            <span className={styles.email}>{me.data.email}</span>
            <span className={styles.topBalance}>{money(0)}</span>
          </span>
        )}
      </header>
      <div className={styles.body}>
        <aside className={menuOpen ? `${styles.side} ${styles.sideOpen}` : styles.side} aria-label={t('Account menu')}>
          {/* Keyed by path: each navigation re-opens the group of the current page. */}
          <SideNav key={pathname} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
        </aside>
        <main className={styles.main}>
          <RequireAuth>
            <Outlet />
          </RequireAuth>
          <AccountFooter />
        </main>
      </div>
      <Toast />
      <ScrollRestoration />
    </div>
  )
}

function SideNav({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState<string | undefined>(groupFor(pathname)?.label)
  return (
    <ul className={styles.nav} onClick={(e) => (e.target as HTMLElement).closest('a') && onNavigate()}>
      {ACCOUNT_NAV.map((g) => {
        const expanded = open === g.label && !!g.children
        const Icon = g.icon
        return (
          <li key={g.label} className={expanded ? styles.groupOpen : undefined}>
            {g.children ? (
              <button type="button" className={styles.groupButton} aria-expanded={expanded} onClick={() => setOpen(expanded ? undefined : g.label)}>
                <Icon size={18} aria-hidden="true" /> {t(g.label)}
                <ChevronDown size={16} aria-hidden="true" className={styles.chevron} />
              </button>
            ) : (
              <NavLink to={g.to} end className={({ isActive }) => (isActive ? `${styles.groupButton} ${styles.groupActive}` : styles.groupButton)}>
                <Icon size={18} aria-hidden="true" /> {t(g.label)}
              </NavLink>
            )}
            {expanded && (
              <ul className={styles.sub}>
                {g.children!.map((c) => (
                  <li key={c.to}>
                    <NavLink to={c.to} end className={({ isActive }) => (isActive ? `${styles.subLink} ${styles.subActive}` : styles.subLink)}>
                      {t(c.label)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function AccountFooter() {
  const { t } = useI18n()
  return (
    <footer className={styles.footer}>
      <nav aria-label={t('Footer')}>
        <Link to="/store">{t('All products')}</Link>
        <Link to="/store?sort=discount">{t('Deals')}</Link>
        <Link to="/will-it-work">{t('Will it work for me?')}</Link>
        <Link to="/proposal">{t('Feature proposal')}</Link>
      </nav>
      <p>
        {t(
          'keyshop is a student demo built for the Eneba Intern Assignment 2027. It is not affiliated with Eneba. All games, sellers and keys are fictional and no real money is charged.',
        )}
      </p>
    </footer>
  )
}

/** Page frame inside the account area: breadcrumbs and the small uppercase title Eneba uses. */
export function AccountPage({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  const { pathname } = useLocation()
  const { t } = useI18n()
  const group = groupFor(pathname)
  useEffect(() => {
    document.title = `${title} — keyshop`
  }, [title])
  return (
    <div className={styles.page}>
      <ol className={styles.crumbs} aria-label={t('Breadcrumbs')}>
        {group && group.label !== title && (
          <li>
            <Link to={group.to}>{t(group.label)}</Link>
          </li>
        )}
        <li aria-current="page">{title}</li>
      </ol>
      <div className={styles.pageHead}>
        <h1 className={styles.h1}>{title}</h1>
        {actions}
      </div>
      {children}
    </div>
  )
}

export function Card({ title, children, className, action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={className ? `${styles.card} ${className}` : styles.card}>
      {title && (
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>{title}</h2>
          {action}
        </div>
      )}
      <div className={styles.cardBody}>{children}</div>
    </section>
  )
}
