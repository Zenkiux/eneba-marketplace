// The visitor's device profile for "Will it work for me?". Kept only in this browser
// (localStorage); it is sent to the API only as filter parameters when the visitor asks for
// "games that work for me".

export type OS = 'windows' | 'mac' | 'linux' | ''
export type Console = 'psn' | 'xbox' | 'nintendo'

export interface DeviceProfile {
  country: string // ISO 3166-1 alpha-2, e.g. "LT"
  os: OS
  gpuName: string
  gpuScore: number
  cpuLabel: string
  cpuScore: number
  ramGb: number
  consoles: Console[]
  detected: boolean // true if filled by automatic detection (then possibly edited)
}

const KEY = 'keyshop.device.v1'
type Listener = () => void
const listeners = new Set<Listener>()
let cache: DeviceProfile | null | undefined

export function getDevice(): DeviceProfile | null {
  if (cache !== undefined) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as DeviceProfile) : null
  } catch {
    cache = null
  }
  return cache
}

export function saveDevice(p: DeviceProfile | null) {
  cache = p
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p))
    else localStorage.removeItem(KEY)
  } catch {
    // storage blocked: the profile lasts for this page view
  }
  listeners.forEach((l) => l())
}

export function subscribeDevice(fn: Listener) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Query parameters for GET /api/products?works=1 */
export function worksParams(p: DeviceProfile): URLSearchParams {
  const q = new URLSearchParams({ works: '1' })
  if (p.country) q.set('country', p.country)
  if (p.os) q.set('os', p.os)
  if (p.gpuScore) q.set('gpu', String(p.gpuScore))
  if (p.cpuScore) q.set('cpu', String(p.cpuScore))
  if (p.ramGb) q.set('ram', String(Math.floor(p.ramGb)))
  if (p.consoles.length) q.set('consoles', p.consoles.join(','))
  return q
}

// CPU choices for manual selection (browsers can't read the CPU model). Scores match the API's
// heuristic in api/internal/compat/hardware.go.
export const CPU_CHOICES = [
  { label: 'Single-core (Pentium 4, Athlon 64)', score: 100 },
  { label: 'Old dual-core (Core 2 Duo, Pentium, Athlon X2)', score: 180 },
  { label: 'Old quad-core (Core 2 Quad, Phenom II X4)', score: 300 },
  { label: 'Intel Core i3/i5 1st–2nd gen · AMD FX', score: 400 },
  { label: 'Intel Core i3/i5 3rd–5th gen · Ryzen 3 1000', score: 600 },
  { label: 'Intel Core i5 6th–8th gen · Ryzen 5 1000–2000', score: 900 },
  { label: 'Intel Core i5/i7 9th–10th gen · Ryzen 5/7 3000', score: 1100 },
  { label: 'Intel Core i5/i7 11th–12th gen · Ryzen 5/7 5000', score: 1300 },
  { label: 'Intel Core 13th–14th gen / Ultra · Ryzen 7000–9000', score: 1550 },
] as const

export const RAM_CHOICES = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 64] as const
