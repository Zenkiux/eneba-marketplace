import type { ReactNode } from 'react'
import styles from './Container.module.css'

/** Centred content column (1240px max, 20px gutters) used by every page. */
export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.container} ${className}`}>{children}</div>
}
