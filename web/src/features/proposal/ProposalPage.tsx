import { useEffect } from 'react'
import { Link } from 'react-router'
import { Container } from '../../components/Container'
import { useI18n } from '../../i18n/useI18n'
import { NOTES } from './notes'
import { ProposalSwitch } from './ProposalSwitch'
import styles from './ProposalPage.module.css'

const ORDER = ['overview', 'detect', 'card', 'filter', 'product', 'cart'] as const

/** Write-up of the proposed feature for the Eneba team. */
export function ProposalPage() {
  const { t } = useI18n()
  useEffect(() => {
    document.title = t('Feature proposal — keyshop')
  }, [t])
  return (
    <Container className={styles.page}>
      <p className={styles.kicker}>{t('Proposal #1 by the candidate')}</p>
      <h1 className={styles.h1}>“Will it work for me?” — check region, platform and PC before buying</h1>
      <p className={styles.lead}>
        The marketplace above replicates eneba.com. This is the one addition I’d propose. Try it as a customer on{' '}
        <Link to="/will-it-work">Will it work for me?</Link>, then turn on <strong>Proposal notes</strong> to see 💡 markers that explain each
        part where it appears in the shop.
      </p>
      <div className={styles.switch}>
        <ProposalSwitch />
      </div>
      {ORDER.map((id) => {
        const n = NOTES[id]!
        return (
          <section key={id} className={styles.section}>
            <h2 className={styles.h2}>{n.title}</h2>
            <dl className={styles.dl}>
              <dt>{t('Problem')}</dt>
              <dd>{n.problem}</dd>
              <dt>{t('Proposed solution')}</dt>
              <dd>{n.solution}</dd>
              <dt>{t('How it works')}</dt>
              <dd>{n.how}</dd>
              <dt>{t('How we’d measure it')}</dt>
              <dd>{n.measure}</dd>
            </dl>
          </section>
        )
      })}
      <section className={styles.section}>
        <h2 className={styles.h2}>{t('Limits and next steps')}</h2>
        <ul className={styles.list}>
          <li>Browsers expose only part of the hardware (GPU name via WebGL, core count, memory capped at 8 GB in Chromium; Safari hides the GPU). The form makes every value editable, and results say “estimate”.</li>
          <li>GPU and CPU scores are approximations; a production version would use a licensed benchmark dataset and per-game frame-rate data.</li>
          <li>Region rules follow the usual meaning of each label; the seller’s listing remains the source of truth. A production version would store the exact country list per listing.</li>
          <li>Next: save the setup to the account (so it follows the buyer across devices), show “Works for you” in search suggestions, and A/B test the cart warning.</li>
        </ul>
      </section>
    </Container>
  )
}
