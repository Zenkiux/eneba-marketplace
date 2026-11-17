import { Heart, KeyRound, LogOut, Percent, Receipt, User, Wallet } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useWishlist } from '../../api/account'
import { useLogout, type User as UserT } from '../../api/auth'
import { useI18n } from '../../i18n/useI18n'
import styles from './UserMenu.module.css'

/** Eneba's avatar button and dropdown (290 px, #5825CC) for a signed-in user. */
export function UserMenu({ user }: { user: UserT }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()
  const logout = useLogout()
  const favs = useWishlist()
  const { t, money } = useI18n()

  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  const initial = user.displayName.slice(0, 1).toUpperCase()
  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={styles.avatarButton}
        aria-label={t('User menu')}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.avatar} aria-hidden="true">
          {initial}
        </span>
      </button>
      {open && (
        <ul id={id} className={styles.menu} onClick={() => setOpen(false)}>
          <li>
            <Link to="/account" className={styles.profile} aria-label={t('My account')}>
              <span className={`${styles.avatar} ${styles.avatarLarge}`} aria-hidden="true">
                {initial}
              </span>
              <span className={styles.profileText}>
                <strong>{user.displayName}</strong>
                <span>{user.email}</span>
              </span>
            </Link>
          </li>
          <li className={styles.sep} role="separator" />
          <li>
            <Link to="/wishlist" className={styles.item}>
              <Heart size={16} aria-hidden="true" /> <span>{t('Favorites')}</span>
              {!!favs.data?.items.length && <span className={styles.badge}>{favs.data.items.length}</span>}
            </Link>
          </li>
          <li className={styles.sep} role="separator" />
          <li>
            <Link to="/account" className={styles.item}>
              <User size={16} aria-hidden="true" /> <span>{t('My account')}</span>
            </Link>
          </li>
          <li>
            <Link to="/account/wallet" className={styles.item}>
              <Wallet size={16} aria-hidden="true" /> <span>{t('Balance')}</span>
              <span className={styles.value}>{money(0)}</span>
            </Link>
          </li>
          <li>
            <Link to="/account/cashback" className={styles.item}>
              <Percent size={16} aria-hidden="true" /> <span>{t('Cashback')}</span>
            </Link>
          </li>
          <li>
            <Link to="/account/orders" className={styles.item}>
              <Receipt size={16} aria-hidden="true" /> <span>{t('Orders')}</span>
            </Link>
          </li>
          <li>
            <Link to="/account/library" className={styles.item}>
              <KeyRound size={16} aria-hidden="true" /> <span>{t('Keys library')}</span>
            </Link>
          </li>
          <li className={styles.sep} role="separator" />
          <li>
            <button type="button" className={styles.item} onClick={() => logout.mutate()}>
              <LogOut size={16} aria-hidden="true" /> <span>{t('Logout')}</span>
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
