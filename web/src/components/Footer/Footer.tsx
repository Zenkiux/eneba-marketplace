import { Link } from 'react-router'
import { useI18n } from '../../i18n/useI18n'
import styles from './Footer.module.css'

export function Footer() {
  const { t } = useI18n()
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <nav className={styles.links} aria-label={t('Footer')}>
          <Link to="/store">{t('All products')}</Link>
          <Link to="/store?sort=discount">{t('Deals')}</Link>
          <Link to="/account/orders">{t('My orders')}</Link>
          <Link to="/will-it-work">{t('Will it work for me?')}</Link>
          <Link to="/proposal">{t('Feature proposal')}</Link>
          <a href="https://github.com/Zenkiux/eneba-marketplace">{t('Source code')}</a>
        </nav>
        <p className={styles.note}>
          {t(
            'keyshop is a student demo built for the Eneba Intern Assignment 2027. It is not affiliated with Eneba. All games, sellers and keys are fictional and no real money is charged.',
          )}
        </p>
      </div>
    </footer>
  )
}
