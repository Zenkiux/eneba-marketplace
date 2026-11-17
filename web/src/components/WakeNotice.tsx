import { useEffect, useState } from 'react'
import { onWakeChange } from '../api/wake'
import styles from './WakeNotice.module.css'

/** Shown while the free-tier API server is starting up after sleeping. */
export function WakeNotice() {
  const [waking, setWaking] = useState(false)
  useEffect(() => onWakeChange(setWaking), [])
  if (!waking) return null
  return (
    <div className={styles.notice} role="status">
      Waking up the server… The free hosting plan sleeps when idle; this can take up to a minute.
    </div>
  )
}
