import { Code2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError, api } from '../../api/client'
import { useI18n } from '../../i18n/useI18n'
import { LocaleSwitcher } from '../LocaleSwitcher'
import styles from './Footer.module.css'

// Eneba's footer layout: link columns, newsletter, language/currency, legal line. Every link
// goes to a real page of this site (the Help page covers what Eneba spreads over many pages).
const COLUMNS: { title: string; links: { label: string; to: string; external?: boolean }[] }[] = [
  {
    title: 'About keyshop',
    links: [
      { label: 'About this project', to: '/help#about' },
      { label: 'Contact us', to: '/help#contact' },
      { label: 'Feature proposals', to: '/proposal' },
      { label: 'Source code', to: 'https://github.com/Zenkiux/eneba-marketplace', external: true },
    ],
  },
  {
    title: 'Buy',
    links: [
      { label: 'How to buy', to: '/help#how-to-buy' },
      { label: 'All products', to: '/store' },
      { label: 'Discounts', to: '/store?sort=discount' },
      { label: 'Gift cards', to: '/store?type=gift-card' },
    ],
  },
  {
    title: 'Help',
    links: [
      { label: 'FAQ', to: '/help#faq' },
      { label: 'How to activate game', to: '/help#activate' },
      { label: 'Return policy', to: '/help#refunds' },
      { label: 'Will it work for me?', to: '/will-it-work' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'My account', to: '/account' },
      { label: 'Orders', to: '/account/orders' },
      { label: 'Keys library', to: '/account/library' },
      { label: 'Favorites', to: '/wishlist' },
    ],
  },
]

export function Footer() {
  const { t } = useI18n()
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <nav className={styles.columns} aria-label={t('Footer')}>
            {COLUMNS.map((c) => (
              <div key={c.title} className={styles.column}>
                <span className={styles.colTitle}>{t(c.title)}</span>
                <ul>
                  {c.links.map((l) => (
                    <li key={l.label}>{l.external ? <a href={l.to}>{t(l.label)}</a> : <Link to={l.to}>{t(l.label)}</Link>}</li>
                  ))}
                </ul>
              </div>
            ))}
            <div className={styles.column}>
              <span className={styles.colTitle}>{t('Follow us')}</span>
              <a href="https://github.com/Zenkiux/eneba-marketplace" className={styles.social}>
                <Code2 size={18} aria-hidden="true" /> GitHub
              </a>
            </div>
          </nav>
          <Newsletter />
        </div>
        <div className={styles.bottom}>
          <LocaleSwitcher />
          <p className={styles.legal}>
            {t('Copyright © 2026 keyshop. A student demo built for the Eneba Intern Assignment 2027; not affiliated with Eneba. All games, sellers and keys are fictional and no real money is charged.')}{' '}
            <Link to="/help#terms">{t('Terms and Conditions')}</Link>, <Link to="/help#privacy">{t('Privacy notice')}</Link>.
          </p>
        </div>
      </div>
    </footer>
  )
}

/** "Get personalized game deals": a real sign-up (stored; this demo sends no e-mails). */
function Newsletter() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | string>('idle')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setState('busy')
    try {
      await api.post('/newsletter', { email })
      setState('done')
      setEmail('')
    } catch (err) {
      setState(err instanceof ApiError ? err.message : t('Could not subscribe.'))
    }
  }
  return (
    <form className={styles.newsletter} onSubmit={(e) => void submit(e)}>
      <span className={styles.colTitle}>{t('Get personalized game deals')}</span>
      <div className={styles.subscribeRow}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('Your e-mail')}
          aria-label={t('Your e-mail')}
          autoComplete="email"
        />
        <button type="submit" disabled={state === 'busy'}>
          {t('Subscribe')}
        </button>
      </div>
      {state === 'done' ? (
        <p className={styles.ok} role="status">
          {t('Subscribed. (This demo stores the address but never sends e-mails.)')}
        </p>
      ) : state !== 'idle' && state !== 'busy' ? (
        <p className={styles.err} role="alert">
          {state}
        </p>
      ) : (
        <p className={styles.small}>
          {t('You can unsubscribe at any time.')} <Link to="/help#privacy">{t('Privacy notice')}</Link>
        </p>
      )}
    </form>
  )
}
