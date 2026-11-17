// Renders original cover and banner images with headless Chromium.
//   node tools/render-art.mjs            -> web/public/covers/*.jpg, web/public/banners/*.jpg
//   node tools/render-art.mjs --only=a,b -> just those cover slugs
// Text is set in Metropolis (bundled from @fontsource), scenes come from scenes.mjs.
// Optional photo backgrounds: put a licensed image at e2e/tools/photos/<slug>.jpg and run with
// --photos; it is used instead of the generated scene (see web/public/assets-credits.md).
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { banners, covers } from './art.config.mjs'
import { rng, scenes } from './scenes.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const fontDir = join(root, 'web/node_modules/@fontsource/metropolis/files')
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const only = args.only ? new Set(args.only.split(',')) : null
const outDir = args.out ? join(root, args.out) : join(root, 'web/public')
const usePhotos = 'photos' in args

const fontFace = [400, 600, 800]
  .map((w) => {
    // Embedded as data URIs: pages created with setContent cannot load file:// fonts.
    const b64 = readFileSync(join(fontDir, `metropolis-latin-${w}-normal.woff2`)).toString('base64')
    return `@font-face{font-family:M;font-weight:${w};src:url(data:font/woff2;base64,${b64}) format('woff2')}`
  })
  .join('')

function background(c, W, H) {
  const photo = join(here, 'photos', `${c.slug}.jpg`)
  if (usePhotos && existsSync(photo)) {
    const data = readFileSync(photo).toString('base64')
    return `<img src="data:image/jpeg;base64,${data}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`
  }
  const svg = scenes[c.motif](W, H, c.palette, rng(c.slug))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;inset:0">${svg}</svg>`
}

function coverHTML(c) {
  const W = 600, H = 900
  const value = c.value ? `<div class="value">${c.value}</div>` : ''
  const badge = c.badge ? `<div class="badge">${c.badge}</div>` : ''
  return `<!doctype html><html><head><style>${fontFace}
    *{margin:0;box-sizing:border-box}
    body{width:${W}px;height:${H}px;position:relative;overflow:hidden;font-family:M,sans-serif;color:#fff}
    .shade{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.78) 0%,rgba(0,0,0,.25) 34%,rgba(0,0,0,0) 52%)}
    .text{position:absolute;left:40px;right:40px;bottom:${c.motif === 'giftcard' ? 300 : 96}px;text-align:center}
    .title{font-weight:800;font-size:${c.title.length > 12 ? 60 : c.title.length > 9 ? 68 : 80}px;line-height:.95;text-transform:uppercase;letter-spacing:1px;text-shadow:0 4px 18px rgba(0,0,0,.55)}
    .sub{margin-top:14px;font-weight:600;font-size:30px;letter-spacing:6px;text-transform:uppercase;text-shadow:0 2px 10px rgba(0,0,0,.6)}
    .studio{position:absolute;bottom:58px;left:0;right:0;text-align:center;font-weight:600;font-size:16px;letter-spacing:4px;text-transform:uppercase;opacity:.75}
    .value{position:absolute;left:0;right:0;bottom:130px;text-align:center;font-weight:800;font-size:64px;color:${c.palette[2]}}
    .badge{position:absolute;top:26px;right:26px;background:${c.palette[2]};color:#000;font-weight:800;font-size:22px;padding:8px 14px}
  </style></head><body>${background(c, W, H)}<div class="shade"></div>${badge}
  <div class="text"><div class="title">${c.title}</div>${c.sub ? `<div class="sub">${c.sub}</div>` : ''}</div>
  ${value}${c.studio ? `<div class="studio">${c.studio}</div>` : ''}</body></html>`
}

function bannerHTML(b) {
  const c = covers.find((x) => x.slug === b.from)
  const wide = b.w > b.h
  return `<!doctype html><html><head><style>${fontFace}
    *{margin:0;box-sizing:border-box}
    body{width:${b.w}px;height:${b.h}px;position:relative;overflow:hidden;font-family:M,sans-serif;color:#fff}
    .shade{position:absolute;inset:0;background:${wide ? 'linear-gradient(to right,rgba(0,0,0,.7),rgba(0,0,0,0) 60%)' : 'linear-gradient(to top,rgba(0,0,0,.8),rgba(0,0,0,0) 60%)'}}
    .text{position:absolute;${wide ? 'left:64px;top:50%;transform:translateY(-50%);width:52%' : 'left:28px;right:28px;bottom:36px'}}
    .k{font-weight:600;font-size:${wide ? 26 : 20}px;margin-bottom:12px;opacity:.9}
    .h{font-weight:800;font-size:${wide ? 64 : 38}px;line-height:1;text-transform:uppercase;text-shadow:0 4px 18px rgba(0,0,0,.5)}
    .cta{display:inline-block;margin-top:24px;background:#fad318;color:#000;font-weight:800;font-size:${wide ? 22 : 18}px;padding:14px 26px}
  </style></head><body>${background(c, b.w, b.h)}<div class="shade"></div>
  <div class="text"><div class="k">${b.kicker}</div><div class="h">${b.headline}</div><div class="cta">${b.cta}</div></div></body></html>`
}

const browser = await chromium.launch()
const page = await browser.newPage()
async function shot(html, w, h, file) {
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(html, { waitUntil: 'load' })
  const ok = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('800 40px M') })
  if (!ok) throw new Error('Metropolis did not load for ' + file)
  mkdirSync(dirname(file), { recursive: true })
  await page.screenshot({ path: file, type: 'jpeg', quality: 84 })
}
let n = 0
for (const c of covers) {
  if (only && !only.has(c.slug)) continue
  await shot(coverHTML(c), 600, 900, join(outDir, 'covers', `${c.slug}.jpg`))
  n++
}
if (!only) {
  for (const b of banners) {
    await shot(bannerHTML(b), b.w, b.h, join(outDir, 'banners', `${b.file}.jpg`))
    n++
  }
}
await browser.close()
console.log(`rendered ${n} image(s) to ${outDir}`)
