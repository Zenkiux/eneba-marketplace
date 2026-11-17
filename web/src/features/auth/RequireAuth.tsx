import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useMe } from '../../api/auth'

/**
 * Sends signed-out visitors to the login page and back afterwards. This is only for user
 * experience: the API enforces authentication on every protected endpoint itself.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe()
  const location = useLocation()
  if (me.isPending) return <div style={{ minHeight: '60vh' }} aria-busy="true" />
  if (!me.data) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <>{children}</>
}
