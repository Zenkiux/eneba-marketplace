import { useEffect, useState } from 'react'
import { onWakeChange } from '../api/wake'
import styles from './WakeNotice.module.css'

/** Shown while the API is unreachable or starting up; requests are retried automatically. */
export function WakeNotice() {
  const [waking, setWaking] = useState(false)
  useEffect(() => onWakeChange(setWaking), [])
  if (!waking) return null
  return (
    <div className={styles.notice} role="status">
      Connecting to the server… retrying automatically. This can take up to a minute.
    </div>
  )
}
