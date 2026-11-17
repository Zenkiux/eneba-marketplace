type Listener = (message: string) => void
export const toastListeners = new Set<Listener>()

/** Shows a short confirmation message (e.g. "Added to cart") at the bottom of the screen. */
export function showToast(message: string) {
  toastListeners.forEach((l) => l(message))
}
