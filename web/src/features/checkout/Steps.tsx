import styles from './checkout.module.css'

const STEPS = ['Cart', 'Checkout', 'Payment', 'Order and key'] as const

/** Progress through the purchase flow (the same steps as the assignment's diagram). */
export function Steps({ current }: { current: (typeof STEPS)[number] }) {
  const index = STEPS.indexOf(current)
  return (
    <ol className={styles.steps} aria-label="Checkout progress">
      {STEPS.map((s, i) => (
        <li key={s} className={i < index ? styles.stepDone : i === index ? styles.stepCurrent : styles.step} aria-current={i === index ? 'step' : undefined}>
          <span className={styles.stepNo}>{i + 1}</span> {s}
        </li>
      ))}
    </ol>
  )
}
