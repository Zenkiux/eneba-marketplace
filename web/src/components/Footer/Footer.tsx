import { Link } from 'react-router'
import styles from './Footer.module.css'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <nav className={styles.links} aria-label="Footer">
          <Link to="/store">All products</Link>
          <Link to="/store?sort=discount">Deals</Link>
          <Link to="/account/orders">My orders</Link>
          <a href="https://github.com/Zenkiux/eneba-marketplace">Source code</a>
        </nav>
        <p className={styles.note}>
          keyshop is a student demo built for the Eneba Intern Assignment 2027. It is not affiliated with Eneba.
          All games, sellers and keys are fictional and no real money is charged.
        </p>
      </div>
    </footer>
  )
}
