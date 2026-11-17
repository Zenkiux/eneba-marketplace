import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { CheckoutHeader } from './CheckoutHeader/CheckoutHeader'
import { Footer } from './Footer'
import { Header } from './Header'
import { Toast } from './Toast'
import { WakeNotice } from './WakeNotice'
import styles from './Layout.module.css'

// Cart, payment and the order page use Eneba's minimal checkout header.
const CHECKOUT_PAGES = /^\/(cart|checkout|orders\/)/

export function Layout() {
  const { pathname } = useLocation()
  return (
    <>
      {CHECKOUT_PAGES.test(pathname) ? <CheckoutHeader /> : <Header />}
      <WakeNotice />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
      <Toast />
      <ScrollRestoration />
    </>
  )
}
