import { Outlet, ScrollRestoration } from 'react-router'
import { Footer } from './Footer'
import { Header } from './Header'
import { Toast } from './Toast'
import { WakeNotice } from './WakeNotice'
import styles from './Layout.module.css'

export function Layout() {
  return (
    <>
      <Header />
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
