import { detectDevice, type DetectResult } from '../../api/compat'

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number
  userAgentData?: { platform?: string }
}

/** The GPU name the browser exposes through WebGL (empty if blocked, e.g. Safari/Firefox privacy modes). */
export function webglRenderer(): string {
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return ''
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
    return typeof name === 'string' ? name : ''
  } catch {
    return ''
  }
}

function platformName(nav: NavigatorWithHints): string {
  const hint = nav.userAgentData?.platform
  if (hint) return hint
  const ua = nav.userAgent
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS'
  if (/Linux|X11/i.test(ua)) return 'Linux'
  return ''
}

/**
 * Reads what a web page may know about the device — no install, nothing stored on a server:
 * GPU name (WebGL), logical CPU cores, approximate memory (Chromium caps it at 8 GB) and OS.
 * The API maps these onto its hardware tables.
 */
export async function detect(): Promise<DetectResult & { raw: { renderer: string; cores: number; memoryGb: number; platform: string } }> {
  const nav = navigator as NavigatorWithHints
  const raw = {
    renderer: webglRenderer().slice(0, 300),
    cores: nav.hardwareConcurrency ?? 0,
    memoryGb: nav.deviceMemory ?? 0,
    platform: platformName(nav),
  }
  const res = await detectDevice(raw)
  return { ...res, raw }
}
