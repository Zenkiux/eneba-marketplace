import { Heart } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { useToggleWishlist, useWishlist } from '../../api/account'
import { useMe } from '../../api/auth'
import { useI18n } from '../../i18n/useI18n'

/** Heart toggle for Favorites. Guests are sent to log in and brought back. */
export function WishlistButton({
  productId,
  title,
  className,
  withLabel = false,
}: {
  productId: number
  title: string
  className?: string
  withLabel?: boolean
}) {
  const me = useMe()
  const list = useWishlist()
  const toggle = useToggleWishlist()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useI18n()
  const on = !!list.data?.items.some((p) => p.id === productId)
  return (
    <button
      type="button"
      className={className}
      aria-pressed={on}
      aria-label={on ? t('Remove {title} from favorites', { title }) : t('Add {title} to favorites', { title })}
      disabled={toggle.isPending}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!me.data) {
          navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)
          return
        }
        toggle.mutate({ productId, on: !on })
      }}
    >
      <Heart size={20} fill={on ? 'currentColor' : 'none'} aria-hidden="true" />
      {withLabel && <span>{on ? t('In favorites') : t('Add to favorites')}</span>}
    </button>
  )
}
