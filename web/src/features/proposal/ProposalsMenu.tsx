import { ArrowRight, Lightbulb } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useI18n } from '../../i18n/useI18n'
import { ProposalSwitch } from './ProposalSwitch'
import styles from './Proposal.module.css'

/** Header button listing the candidate's feature proposals for the Eneba team. */
export function ProposalsMenu({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useI18n()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onScroll = () => setOpen(false) // the panel is fixed-positioned; don't let it float away from the button
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll)
    }
  }, [open])

  const go = () => {
    setOpen(false)
    onNavigate?.()
  }

  return (
    <div className={styles.menuWrap} ref={ref}>
      <button
        type="button"
        className={styles.menuButton}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          // The category bar scrolls horizontally (overflow), which would clip a normal dropdown:
          // on wide screens the panel is fixed-positioned under the button instead.
          const r = buttonRef.current?.getBoundingClientRect()
          setPos(r && window.innerWidth > 900 ? { top: r.bottom + 8, right: window.innerWidth - r.right } : null)
          setOpen((o) => !o)
        }}
        ref={buttonRef}
      >
        <Lightbulb size={16} aria-hidden="true" /> {t('Proposals')}
      </button>
      {open && (
        <div
          id={panelId}
          className={styles.menu}
          role="dialog"
          aria-label={t('Feature proposals')}
          style={pos ? { position: 'fixed', top: pos.top, right: pos.right } : undefined}
        >
          <p className={styles.menuKicker}>{t('Ideas I’d bring to Eneba')}</p>
          <article className={styles.menuItem}>
            <span className={styles.menuNumber}>#1</span>
            <div>
              <h3>{t('Will it work for me?')}</h3>
              <p>{t('Check region, console and PC requirements before buying — like CYRI, built into the shop.')}</p>
              <div className={styles.menuActions}>
                <Link to="/will-it-work" className={styles.menuPrimary} onClick={go}>
                  {t('Try it')} <ArrowRight size={14} aria-hidden="true" />
                </Link>
                <Link to="/proposal" className={styles.menuSecondary} onClick={go}>
                  {t('Why and how')}
                </Link>
              </div>
            </div>
          </article>
          <div className={styles.menuFoot}>
            <ProposalSwitch />
            <small>{t('Shows 💡 explanations where the feature appears: Will it work page, store filter, product pages and cart.')}</small>
          </div>
        </div>
      )}
    </div>
  )
}
