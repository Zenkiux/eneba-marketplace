import { setProposalNotes, useProposalNotes } from './proposalMode'
import { useI18n } from '../../i18n/useI18n'
import styles from './Proposal.module.css'

/** Toggle for the team-facing explanations of the proposed feature. */
export function ProposalSwitch() {
  const on = useProposalNotes()
  const { t } = useI18n()
  return (
    <button type="button" role="switch" aria-checked={on} className={styles.switch} onClick={() => setProposalNotes(!on)}>
      <span className={on ? `${styles.track} ${styles.trackOn}` : styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      {t('Proposal notes')}
    </button>
  )
}
