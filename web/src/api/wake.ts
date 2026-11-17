// The free API host sleeps after 15 idle minutes and takes ~1 minute to wake. While it wakes,
// requests fail with 502/503/504 or get an HTML loading page. The client retries GETs and
// publishes the state here so the layout can show a notice.

type Listener = (waking: boolean) => void
const listeners = new Set<Listener>()
let pending = 0

export function onWakeChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function wakeStart() {
  pending++
  if (pending === 1) listeners.forEach((l) => l(true))
}

export function wakeEnd() {
  pending = Math.max(0, pending - 1)
  if (pending === 0) listeners.forEach((l) => l(false))
}
