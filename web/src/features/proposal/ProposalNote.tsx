import { Lightbulb, X } from 'lucide-react'
import { useId, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { NOTES } from './notes'
import { useProposalNotes } from './proposalMode'
import styles from './Proposal.module.css'

/** A 💡 marker explaining part of the proposed feature (visible only with "Proposal notes" on). */
export function ProposalNote({ id, inline = false }: { id: keyof typeof NOTES; inline?: boolean }) {
  const on = useProposalNotes()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const { t } = useI18n()
  const note = NOTES[id]
  if (!on || !note) return null
  return (
    <span className={inline ? `${styles.wrap} ${styles.inline}` : styles.wrap}>
      <button type="button" className={styles.marker} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        <Lightbulb size={14} aria-hidden="true" /> {t('Proposal')}
      </button>
      {open && (
        <span id={panelId} role="dialog" aria-label={note.title} className={styles.panel}>
          <span className={styles.panelHead}>
            <strong>{note.title}</strong>
            <button type="button" aria-label={t('Close note')} onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </span>
          <span className={styles.label}>{t('Problem')}</span>
          <span>{note.problem}</span>
          <span className={styles.label}>{t('Proposed solution')}</span>
          <span>{note.solution}</span>
          <span className={styles.label}>{t('How it works')}</span>
          <span>{note.how}</span>
          <span className={styles.label}>{t('How we’d measure it')}</span>
          <span>{note.measure}</span>
        </span>
      )}
    </span>
  )
}
