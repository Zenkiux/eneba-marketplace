import { Link } from 'react-router'
import styles from './Header.module.css'

/** Placeholder site header. The full Eneba-style header (search, cart, account) comes later. */
export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.wordmark}>
          keyshop
        </Link>
      </div>
    </header>
  )
}
