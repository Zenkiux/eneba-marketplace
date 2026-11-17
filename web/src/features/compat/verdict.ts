import type { DeviceProfile } from './device'
import { regionWorksIn } from './regions'

export interface ReqLevel {
  os?: string
  gpuScore?: number
  cpuScore?: number
  ramGb?: number
}

export type Part = 'region' | 'platform' | 'os' | 'gpu' | 'cpu' | 'ram'

export interface Verdict {
  status: 'works' | 'no' | 'unknown'
  failing: Part[] // why it doesn't work
}

const CONSOLE_OF: Record<string, 'psn' | 'xbox' | 'nintendo'> = { psn: 'psn', xbox: 'xbox', nintendo: 'nintendo' }

/** Hardware parts below a requirement level (unknown device values never count as failures). */
export function hardwareShort(p: DeviceProfile, l: ReqLevel | null | undefined): Part[] {
  if (!l) return []
  const out: Part[] = []
  if (l.os && p.os && l.os !== p.os) out.push('os')
  if (l.gpuScore && p.gpuScore && p.gpuScore < l.gpuScore) out.push('gpu')
  if (l.cpuScore && p.cpuScore && p.cpuScore < l.cpuScore) out.push('cpu')
  if (l.ramGb && p.ramGb && p.ramGb + 0.01 < l.ramGb) out.push('ram')
  return out
}

/** Does this product work for the visitor? Same rules as the API's works=1 filter. */
export function verdictFor(
  p: DeviceProfile,
  product: { platform: { slug: string }; region: { slug: string }; reqMin?: ReqLevel | null },
): Verdict {
  const failing: Part[] = []
  if (!regionWorksIn(product.region.slug, p.country)) failing.push('region')
  const consoleKey = CONSOLE_OF[product.platform.slug]
  if (consoleKey) {
    if (!p.consoles.includes(consoleKey)) failing.push('platform')
  } else if (product.platform.slug !== 'keyshop') {
    failing.push(...hardwareShort(p, product.reqMin))
  }
  if (failing.length) return { status: 'no', failing }
  const hardwareUnknown = !consoleKey && product.reqMin && (!p.gpuScore || !p.cpuScore || !p.ramGb)
  return { status: hardwareUnknown ? 'unknown' : 'works', failing }
}

export const PART_LABEL: Record<Part, string> = {
  region: 'region-locked for your country',
  platform: 'needs a console you don’t have',
  os: 'needs another operating system',
  gpu: 'graphics card below minimum',
  cpu: 'processor below minimum',
  ram: 'not enough memory',
}
