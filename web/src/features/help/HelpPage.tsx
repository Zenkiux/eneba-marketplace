import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { Container } from '../../components/Container'
import { useI18n } from '../../i18n/useI18n'
import styles from './HelpPage.module.css'

// One page for what Eneba spreads over its support centre (how to buy, activation, refunds,
// FAQ) plus this project's terms and privacy notice. Linked from the footer by anchor.
const SECTIONS = [
  { id: 'about', title: 'About this project' },
  { id: 'how-to-buy', title: 'How to buy' },
  { id: 'activate', title: 'How to activate a game key' },
  { id: 'refunds', title: 'Return policy' },
  { id: 'faq', title: 'FAQ' },
  { id: 'contact', title: 'Contact us' },
  { id: 'terms', title: 'Terms and Conditions' },
  { id: 'privacy', title: 'Privacy notice' },
]

export function HelpPage() {
  const { t } = useI18n()
  const { hash } = useLocation()
  useEffect(() => {
    document.title = t('Help — keyshop')
  }, [t])
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])
  return (
    <Container className={styles.page}>
      <h1 className={styles.h1}>{t('Help centre')}</h1>
      <nav className={styles.toc} aria-label={t('On this page')}>
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`}>
            {t(s.title)}
          </a>
        ))}
      </nav>

      <section id="about" className={styles.section}>
        <h2>{t('About this project')}</h2>
        <p>{t('keyshop is a student project for the Eneba Intern Assignment 2027: a digital-key marketplace in Eneba’s style, built with React, Go and PostgreSQL. It is not affiliated with Eneba. The default catalog, sellers and keys are fictional; the optional “Eneba catalog” shows a snapshot of real Eneba listings for demonstration.')}</p>
      </section>

      <section id="how-to-buy" className={styles.section}>
        <h2>{t('How to buy')}</h2>
        <ol>
          <li>{t('Find a product with the search box or in the store, and compare the sellers’ offers on its page.')}</li>
          <li>{t('Press “Buy now” (or “Add to cart”) on the offer you want.')}</li>
          <li>{t('In the cart press “Proceed to checkout”. You’ll be asked to log in or create an account.')}</li>
          <li>{t('Choose a payment method and press “Continue”. Payment is simulated: no real money is charged.')}</li>
          <li>{t('Your keys appear right away and stay in your account under Keys library.')}</li>
        </ol>
      </section>

      <section id="activate" className={styles.section}>
        <h2>{t('How to activate a game key')}</h2>
        <p>{t('Keys bought here are demo keys and can’t be activated anywhere. On a real store the steps are:')}</p>
        <ul>
          <li>{t('Steam: Games → Activate a Product on Steam, then paste the key.')}</li>
          <li>{t('Xbox: redeem.microsoft.com or Store → Redeem on the console.')}</li>
          <li>{t('PlayStation: Settings → Users and Accounts → Redeem Codes.')}</li>
          <li>{t('Nintendo: Nintendo eShop → Redeem Code.')}</li>
        </ul>
        <p>
          {t('Not sure a key will work for you? Check region, console and PC first:')} <Link to="/will-it-work">{t('Will it work for me?')}</Link>
        </p>
      </section>

      <section id="refunds" className={styles.section}>
        <h2>{t('Return policy')}</h2>
        <p>{t('Nothing is charged in this demo, so there is nothing to refund. You can cancel an unpaid order from the payment page; its keys go back to the seller immediately, and unpaid orders expire after 15 minutes.')}</p>
      </section>

      <section id="faq" className={styles.section}>
        <h2>{t('FAQ')}</h2>
        <dl>
          <dt>{t('Why are there several offers for one game?')}</dt>
          <dd>{t('Like on Eneba, independent sellers list keys for the same product. Compare price and seller rating, then pick the offer you want.')}</dd>
          <dt>{t('What does the region mean?')}</dt>
          <dd>{t('Keys only activate in certain countries: “Global” works everywhere, “Europe” in the EU/EEA and the UK, and so on. The product page tells you where a key can be activated.')}</dd>
          <dt>{t('Can I pay in another currency?')}</dt>
          <dd>{t('You can display prices in several currencies; orders are always charged in euros at the shown rate.')}</dd>
          <dt>{t('Where are my keys?')}</dt>
          <dd>
            {t('In your account:')} <Link to="/account/library">{t('Keys library')}</Link>.
          </dd>
        </dl>
      </section>

      <section id="contact" className={styles.section}>
        <h2>{t('Contact us')}</h2>
        <p>
          {t('Questions or bug reports about this project:')} <a href="https://github.com/Zenkiux/eneba-marketplace/issues">{t('open an issue on GitHub')}</a>.
        </p>
      </section>

      <section id="terms" className={styles.section}>
        <h2>{t('Terms and Conditions')}</h2>
        <p>{t('This site is a demonstration. Nothing on it is for sale, keys are not real and no payment is taken. Please don’t enter real payment details or personal data you don’t want stored on a demo server.')}</p>
      </section>

      <section id="privacy" className={styles.section}>
        <h2>{t('Privacy notice')}</h2>
        <p>{t('What the server stores: your e-mail address, a hashed password, your display name, sign-in sessions (browser name and country, no IP address), orders, favourites, reviews and newsletter sign-ups. What stays only in your browser: the guest cart, language and currency, your “Will it work for me?” setup and recently viewed products.')}</p>
        <p>{t('No tracking or advertising cookies are used. To delete your data, open an issue on GitHub.')}</p>
      </section>
    </Container>
  )
}
