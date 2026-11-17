import { useEffect, useState } from 'react'
import styles from './Toast.module.css'

import { toastListeners as listeners } from './toastBus'

export function Toast() {
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const l = (m: string) => {
      setMessage(m)
      clearTimeout(timer)
      timer = setTimeout(() => setMessage(null), 3000)
    }
    listeners.add(l)
    return () => {
      listeners.delete(l)
      clearTimeout(timer)
    }
  }, [])
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {message && <div className={styles.toast}>{message}</div>}
    </div>
  )
}
