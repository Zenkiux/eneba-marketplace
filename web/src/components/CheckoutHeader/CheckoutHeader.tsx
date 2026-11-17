import { Link, useLocation } from 'react-router'
import { useI18n } from '../../i18n/useI18n'
import { Logo } from '../Header/Logo'
import { LocaleSwitcher } from '../LocaleSwitcher'
import styles from './CheckoutHeader.module.css'

/**
 * Eneba's checkout uses its own minimal header: logo, the three steps
 * (Cart → Payment → Get your product) and the language/currency selector.
 */
export function CheckoutHeader() {
  const { pathname } = useLocation()
  const { t } = useI18n()
  const step = pathname.startsWith('/orders/') ? 2 : pathname.startsWith('/checkout') ? 1 : 0
  const steps = [t('Cart'), t('Payment'), t('Get your product')]
  return (
    <header className={styles.bar}>
      <Link to="/" className={styles.logo} aria-label={t('keyshop home')}>
        <Logo />
      </Link>
      <ol className={styles.steps} aria-label={t('Checkout progress')}>
        {steps.map((label, i) => {
          const cls = i === step ? styles.active : i < step ? styles.done : styles.todo
          return (
            <li key={label} className={cls} aria-current={i === step ? 'step' : undefined}>
              {i === 0 && step < 2 ? <Link to="/cart">{label}</Link> : <span>{label}</span>}
            </li>
          )
        })}
      </ol>
      <div className={styles.locale}>
        <LocaleSwitcher />
      </div>
    </header>
  )
}
