// Procedural scenes for generated cover art. Each scene returns SVG markup for a W×H canvas.
// Everything is drawn from shapes and gradients, seeded per title so output is reproducible.

export function rng(seedText) {
  let h = 1779033703 ^ seedText.length
  for (let i = 0; i < seedText.length; i++) {
    h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

const sky = (W, H, [a, b], id = 'sky') =>
  `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
   <rect width="${W}" height="${H}" fill="url(#${id})"/>`

const glow = (cx, cy, r, color, op = 0.6, id = 'g' + Math.round(cx + cy + r)) =>
  `<defs><radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs>
   <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})"/>`

function stars(W, H, r, n, color = '#fff', maxY = 1) {
  let s = ''
  for (let i = 0; i < n; i++) {
    const size = r() < 0.9 ? r() * 1.6 + 0.4 : r() * 3 + 1.5
    s += `<circle cx="${r() * W}" cy="${r() * H * maxY}" r="${size}" fill="${color}" opacity="${0.4 + r() * 0.6}"/>`
  }
  return s
}

function ridge(W, H, r, baseY, amp, color, steps = 14, op = 1) {
  let d = `M0 ${H} L0 ${baseY}`
  for (let i = 1; i <= steps; i++) d += ` L${(W / steps) * i} ${baseY - r() * amp}`
  return `<path d="${d} L${W} ${H} Z" fill="${color}" opacity="${op}"/>`
}

export const scenes = {
  space(W, H, p, r) {
    const px = W * (0.3 + r() * 0.4), py = H * 0.38, pr = W * 0.32
    return sky(W, H, p) + stars(W, H, r, 260) + glow(W * 0.7, H * 0.2, W * 0.7, p[2], 0.45) + glow(W * 0.2, H * 0.6, W * 0.6, p[3], 0.25) +
      `<defs><radialGradient id="pl" cx="0.35" cy="0.3"><stop offset="0" stop-color="${p[3]}"/><stop offset="0.55" stop-color="${p[2]}"/><stop offset="1" stop-color="${p[0]}"/></radialGradient></defs>
       <circle cx="${px}" cy="${py}" r="${pr}" fill="url(#pl)"/>
       <ellipse cx="${px}" cy="${py}" rx="${pr * 1.7}" ry="${pr * 0.28}" fill="none" stroke="${p[3]}" stroke-width="6" opacity="0.7" transform="rotate(-14 ${px} ${py})"/>
       <circle cx="${W * 0.82}" cy="${H * 0.12}" r="${W * 0.05}" fill="${p[3]}" opacity="0.9"/>` +
      ridge(W, H, r, H * 0.86, H * 0.08, p[0], 18)
  },
  neon(W, H, p, r) {
    let grid = ''
    const hz = H * 0.58
    for (let i = 0; i <= 16; i++) {
      const x = (W / 16) * i
      grid += `<line x1="${W / 2 + (x - W / 2) * 0.15}" y1="${hz}" x2="${W / 2 + (x - W / 2) * 3}" y2="${H}" stroke="${p[3]}" stroke-width="2" opacity="0.7"/>`
    }
    for (let j = 1; j <= 12; j++) {
      const y = hz + (H - hz) * Math.pow(j / 12, 2)
      grid += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${p[3]}" stroke-width="2" opacity="0.6"/>`
    }
    let bands = ''
    for (let k = 0; k < 6; k++) bands += `<rect x="0" y="${hz - W * 0.33 + k * 30 + 70}" width="${W}" height="${4 + k * 2}" fill="${p[0]}"/>`
    return sky(W, H, p) + stars(W, H * 0.5, r, 80) +
      `<defs><linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe66d"/><stop offset="1" stop-color="${p[2]}"/></linearGradient>
       <clipPath id="sc"><rect width="${W}" height="${hz}"/></clipPath></defs>
       <g clip-path="url(#sc)"><circle cx="${W / 2}" cy="${hz}" r="${W * 0.33}" fill="url(#sun)"/>${bands}</g>` +
      glow(W / 2, hz, W * 0.7, p[2], 0.35) + `<rect y="${hz}" width="${W}" height="${H - hz}" fill="${p[0]}"/>` + grid
  },
  ember(W, H, p, r) {
    let embers = ''
    for (let i = 0; i < 90; i++) embers += `<circle cx="${r() * W}" cy="${r() * H}" r="${r() * 3 + 1}" fill="${r() < 0.5 ? p[2] : p[3]}" opacity="${r()}"/>`
    const cx = W / 2, cy = H * 0.4
    const crown = `<path d="M${cx - 150} ${cy + 70} L${cx - 170} ${cy - 60} L${cx - 85} ${cy} L${cx} ${cy - 110} L${cx + 85} ${cy} L${cx + 170} ${cy - 60} L${cx + 150} ${cy + 70} Z" fill="none" stroke="${p[3]}" stroke-width="10" stroke-linejoin="round"/>
      <rect x="${cx - 150}" y="${cy + 80}" width="300" height="22" fill="${p[3]}"/>`
    return sky(W, H, p) + glow(cx, cy, W * 0.75, p[2], 0.55) + crown + ridge(W, H, r, H * 0.78, H * 0.12, p[0], 10) + embers
  },
  ocean(W, H, p, r) {
    let waves = ''
    for (let i = 0; i < 5; i++) {
      const y = H * (0.6 + i * 0.08)
      let d = `M0 ${y}`
      for (let x = 0; x <= W; x += 40) d += ` Q${x + 20} ${y - 18 - r() * 10} ${x + 40} ${y}`
      waves += `<path d="${d} L${W} ${H} L0 ${H} Z" fill="${p[1]}" opacity="${0.35 + i * 0.13}"/>`
    }
    const ship = `<path d="M${W * 0.25} ${H * 0.58} L${W * 0.75} ${H * 0.58} L${W * 0.68} ${H * 0.64} L${W * 0.32} ${H * 0.64} Z" fill="${p[0]}"/>
      <rect x="${W * 0.47}" y="${H * 0.36}" width="10" height="${H * 0.22}" fill="${p[0]}"/>
      <path d="M${W * 0.49} ${H * 0.37} L${W * 0.66} ${H * 0.5} L${W * 0.49} ${H * 0.54} Z" fill="${p[3]}"/>
      <path d="M${W * 0.47} ${H * 0.39} L${W * 0.33} ${H * 0.53} L${W * 0.47} ${H * 0.55} Z" fill="${p[3]}" opacity="0.85"/>`
    return sky(W, H, p) + glow(W * 0.7, H * 0.25, W * 0.6, p[2], 0.6) + `<circle cx="${W * 0.7}" cy="${H * 0.25}" r="${W * 0.1}" fill="${p[2]}"/>` + ship + waves
  },
  pixel(W, H, p, r) {
    const s = 30
    let blocks = ''
    for (let x = 0; x < W; x += s) {
      const top = H * 0.62 + Math.floor(r() * 3) * s
      blocks += `<rect x="${x}" y="${top}" width="${s}" height="${s}" fill="${p[2]}"/><rect x="${x}" y="${top + s}" width="${s}" height="${H}" fill="#8a5a2b"/>`
      for (let y = top + 2 * s; y < H; y += s) if (r() < 0.15) blocks += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${r() < 0.5 ? '#6b6b6b' : p[3]}"/>`
    }
    let clouds = ''
    for (let i = 0; i < 4; i++) {
      const cx = r() * W, cy = H * (0.1 + r() * 0.3)
      clouds += `<rect x="${cx}" y="${cy}" width="${s * 4}" height="${s}" fill="#fff"/><rect x="${cx + s}" y="${cy - s}" width="${s * 2}" height="${s}" fill="#fff"/>`
    }
    const tree = (x) => `<rect x="${x}" y="${H * 0.62 - s * 3}" width="${s}" height="${s * 3}" fill="#6b4423"/><rect x="${x - s}" y="${H * 0.62 - s * 6}" width="${s * 3}" height="${s * 3}" fill="#2f8f3a"/>`
    return sky(W, H, p) + `<rect x="${W * 0.72}" y="${H * 0.08}" width="${s * 3}" height="${s * 3}" fill="${p[3]}"/>` + clouds + tree(W * 0.2) + tree(W * 0.75) + blocks
  },
  snow(W, H, p, r) {
    let flakes = ''
    for (let i = 0; i < 160; i++) flakes += `<circle cx="${r() * W}" cy="${r() * H}" r="${r() * 2.5 + 0.5}" fill="#fff" opacity="${0.4 + r() * 0.6}"/>`
    return sky(W, H, p) + glow(W * 0.3, H * 0.2, W * 0.6, p[3], 0.5) +
      ridge(W, H, r, H * 0.55, H * 0.22, '#3d5f8a', 7) + ridge(W, H, r, H * 0.68, H * 0.16, '#a9c6e6', 9) + ridge(W, H, r, H * 0.82, H * 0.08, p[2], 12) +
      `<rect x="${W * 0.44}" y="${H * 0.74}" width="${W * 0.12}" height="${H * 0.07}" fill="#2a1d14"/><path d="M${W * 0.42} ${H * 0.745} L${W * 0.5} ${H * 0.69} L${W * 0.58} ${H * 0.745} Z" fill="#fff"/>
       <rect x="${W * 0.48}" y="${H * 0.765}" width="${W * 0.03}" height="${H * 0.025}" fill="#ffb84d"/>` + glow(W * 0.5, H * 0.78, 60, '#ffb84d', 0.6) + flakes
  },
  noir(W, H, p, r) {
    let blinds = ''
    for (let i = 0; i < 14; i++) blinds += `<rect x="${W * 0.08}" y="${H * 0.08 + i * 26}" width="${W * 0.84}" height="12" fill="${p[2]}" opacity="0.12"/>`
    let windows = ''
    for (let b = 0; b < 7; b++) {
      const x = b * (W / 7), bh = H * (0.25 + r() * 0.3)
      windows += `<rect x="${x}" y="${H - bh}" width="${W / 7 - 6}" height="${bh}" fill="${p[0]}"/>`
      for (let wy = H - bh + 14; wy < H - 10; wy += 22) for (let wx = x + 8; wx < x + W / 7 - 16; wx += 16) if (r() < 0.25) windows += `<rect x="${wx}" y="${wy}" width="7" height="10" fill="${p[3]}" opacity="0.85"/>`
    }
    return sky(W, H, p) + glow(W * 0.68, H * 0.24, W * 0.4, p[2], 0.5) + `<circle cx="${W * 0.68}" cy="${H * 0.24}" r="${W * 0.13}" fill="${p[2]}"/>` + blinds + windows
  },
  lighthouse(W, H, p, r) {
    const bx = W * 0.62
    return sky(W, H, [p[0], p[1]]) + stars(W, H, r, 60, '#fff', 0.4) +
      `<path d="M${bx} ${H * 0.36} L${-W * 0.2} ${H * 0.2} L${-W * 0.2} ${H * 0.44} Z" fill="${p[2]}" opacity="0.35"/>` +
      glow(bx, H * 0.36, 120, p[2], 0.9) +
      `<path d="M${bx - 26} ${H * 0.72} L${bx - 16} ${H * 0.38} L${bx + 16} ${H * 0.38} L${bx + 26} ${H * 0.72} Z" fill="#f4efe6"/>
       <rect x="${bx - 22}" y="${H * 0.5}" width="44" height="22" fill="#c8453b"/><rect x="${bx - 24}" y="${H * 0.62}" width="48" height="22" fill="#c8453b"/>
       <rect x="${bx - 20}" y="${H * 0.33}" width="40" height="${H * 0.05}" fill="${p[2]}"/><path d="M${bx - 24} ${H * 0.33} L${bx} ${H * 0.29} L${bx + 24} ${H * 0.33} Z" fill="#2b2b3a"/>` +
      ridge(W, H, r, H * 0.74, H * 0.05, '#2b2b3a', 8) + `<rect y="${H * 0.78}" width="${W}" height="${H * 0.22}" fill="${p[3]}" opacity="0.55"/>`
  },
  castle(W, H, p, r) {
    const c = p[3], base = H * 0.66
    let castle = `<rect x="${W * 0.22}" y="${base - 140}" width="${W * 0.56}" height="140" fill="${c}"/>`
    for (const [x, h] of [[0.18, 230], [0.44, 300], [0.72, 210]]) {
      castle += `<rect x="${W * x}" y="${base - h}" width="${W * 0.1}" height="${h}" fill="${c}"/><path d="M${W * x - 8} ${base - h} L${W * (x + 0.05)} ${base - h - 70} L${W * (x + 0.1) + 8} ${base - h} Z" fill="${p[0]}"/>`
      castle += `<rect x="${W * (x + 0.035)}" y="${base - h + 40}" width="${W * 0.03}" height="26" fill="${p[2]}"/>`
    }
    for (let x = W * 0.22; x < W * 0.78; x += 28) castle += `<rect x="${x}" y="${base - 158}" width="16" height="18" fill="${c}"/>`
    return sky(W, H, p) + glow(W * 0.5, base - 120, W * 0.8, p[2], 0.45) + stars(W, H, r, 50, '#fff', 0.35) + castle +
      ridge(W, H, r, base + 10, 30, '#3a2a40', 8) + ridge(W, H, r, H * 0.8, 40, '#22192b', 6)
  },
  tactical(W, H, p, r) {
    let hex = ''
    for (let y = 0; y < H; y += 52) for (let x = (y / 52) % 2 ? 30 : 0; x < W; x += 60)
      hex += `<polygon points="${x},${y + 15} ${x + 26},${y} ${x + 52},${y + 15} ${x + 52},${y + 45} ${x + 26},${y + 60} ${x},${y + 45}" fill="none" stroke="${p[3]}" stroke-width="1" opacity="${0.05 + r() * 0.12}"/>`
    const cx = W / 2, cy = H * 0.42
    return sky(W, H, p) + hex + glow(cx, cy, W * 0.6, p[2], 0.45) +
      `<circle cx="${cx}" cy="${cy}" r="${W * 0.26}" fill="none" stroke="${p[2]}" stroke-width="4"/>
       <circle cx="${cx}" cy="${cy}" r="${W * 0.16}" fill="none" stroke="${p[3]}" stroke-width="2" stroke-dasharray="10 8"/>
       <line x1="${cx - W * 0.36}" y1="${cy}" x2="${cx + W * 0.36}" y2="${cy}" stroke="${p[2]}" stroke-width="3"/>
       <line x1="${cx}" y1="${cy - W * 0.36}" x2="${cx}" y2="${cy + W * 0.36}" stroke="${p[2]}" stroke-width="3"/>
       <circle cx="${cx}" cy="${cy}" r="8" fill="${p[2]}"/>` +
      `<path d="M0 ${H * 0.75} L${W * 0.3} ${H * 0.7} L${W * 0.55} ${H * 0.77} L${W} ${H * 0.68} L${W} ${H} L0 ${H} Z" fill="#000" opacity="0.8"/>`
  },
  farm(W, H, p, r) {
    let rows = ''
    for (let i = 0; i < 9; i++) rows += `<path d="M${W * 0.5} ${H * 0.62} L${-W + i * W * 0.4} ${H} L${-W + i * W * 0.4 + W * 0.2} ${H} Z" fill="${i % 2 ? '#8bd15a' : p[2]}"/>`
    return sky(W, H, p) + `<circle cx="${W * 0.78}" cy="${H * 0.16}" r="${W * 0.09}" fill="${p[3]}"/>` + glow(W * 0.78, H * 0.16, W * 0.3, p[3], 0.6) +
      `<ellipse cx="${W * 0.2}" cy="${H * 0.62}" rx="${W * 0.6}" ry="${H * 0.12}" fill="#9be07a"/><ellipse cx="${W * 0.85}" cy="${H * 0.63}" rx="${W * 0.5}" ry="${H * 0.1}" fill="#7fcf5c"/>` +
      `<rect x="${W * 0.6}" y="${H * 0.5}" width="${W * 0.18}" height="${H * 0.1}" fill="#d9483b"/><path d="M${W * 0.58} ${H * 0.5} L${W * 0.69} ${H * 0.44} L${W * 0.8} ${H * 0.5} Z" fill="#8a2a22"/><rect x="${W * 0.665}" y="${H * 0.55}" width="${W * 0.05}" height="${H * 0.05}" fill="#fff"/>` + rows
  },
  abyss(W, H, p, r) {
    let bubbles = '', rays = ''
    for (let i = 0; i < 60; i++) bubbles += `<circle cx="${r() * W}" cy="${r() * H}" r="${r() * 5 + 1}" fill="none" stroke="${p[2]}" opacity="${r() * 0.6}"/>`
    for (let i = 0; i < 6; i++) rays += `<path d="M${W * (0.2 + i * 0.12)} 0 L${W * (0.1 + i * 0.12)} ${H * 0.7} L${W * (0.16 + i * 0.12)} ${H * 0.7} Z" fill="${p[2]}" opacity="0.05"/>`
    const eye = (x, y) => glow(x, y, 26, p[3], 1) + `<circle cx="${x}" cy="${y}" r="5" fill="${p[3]}"/>`
    return sky(W, H, p) + rays + glow(W * 0.5, 0, W * 0.8, p[2], 0.35) + bubbles +
      `<rect x="${W * 0.3}" y="${H * 0.5}" width="${W * 0.4}" height="${H * 0.12}" fill="#06141c"/><circle cx="${W * 0.5}" cy="${H * 0.5}" r="${W * 0.12}" fill="#06141c"/><rect x="${W * 0.45}" y="${H * 0.46}" width="${W * 0.1}" height="10" fill="${p[2]}" opacity="0.8"/>` +
      eye(W * 0.2, H * 0.78) + eye(W * 0.26, H * 0.775)
  },
  city(W, H, p, r) {
    let b = ''
    for (let i = 0; i < 12; i++) {
      const w = W / 12, x = i * w, h = H * (0.2 + r() * 0.45)
      b += `<rect x="${x}" y="${H * 0.85 - h}" width="${w - 4}" height="${h}" fill="${p[3]}"/>`
      for (let y = H * 0.85 - h + 10; y < H * 0.84; y += 18) for (let xx = x + 6; xx < x + w - 10; xx += 12) if (r() < 0.35) b += `<rect x="${xx}" y="${y}" width="5" height="8" fill="${p[2]}"/>`
    }
    const crane = `<rect x="${W * 0.66}" y="${H * 0.12}" width="6" height="${H * 0.5}" fill="${p[3]}"/><rect x="${W * 0.5}" y="${H * 0.12}" width="${W * 0.36}" height="6" fill="${p[3]}"/><line x1="${W * 0.55}" y1="${H * 0.13}" x2="${W * 0.55}" y2="${H * 0.3}" stroke="${p[3]}" stroke-width="2"/>`
    return sky(W, H, p) + glow(W * 0.3, H * 0.62, W * 0.7, p[2], 0.7) + crane + b + `<rect y="${H * 0.85}" width="${W}" height="${H * 0.15}" fill="${p[3]}"/>`
  },
  wilds(W, H, p, r) {
    let trees = ''
    for (let i = 0; i < 22; i++) {
      const x = r() * W, y = H * (0.68 + r() * 0.2), s = 30 + r() * 40
      trees += `<path d="M${x} ${y - s * 2.4} L${x - s * 0.6} ${y} L${x + s * 0.6} ${y} Z" fill="${p[2]}"/>`
    }
    const wolf = `<path d="M${W * 0.42} ${H * 0.58} L${W * 0.47} ${H * 0.44} L${W * 0.5} ${H * 0.5} L${W * 0.53} ${H * 0.44} L${W * 0.58} ${H * 0.58} L${W * 0.55} ${H * 0.66} L${W * 0.45} ${H * 0.66} Z" fill="#141c26"/>`
    return sky(W, H, p) + `<circle cx="${W * 0.5}" cy="${H * 0.36}" r="${W * 0.2}" fill="${p[3]}"/>` + glow(W * 0.5, H * 0.36, W * 0.5, p[3], 0.5) +
      ridge(W, H, r, H * 0.62, H * 0.15, '#2b3a4a', 8) + `<rect x="${W * 0.35}" y="${H * 0.6}" width="${W * 0.3}" height="${H * 0.08}" fill="#141c26"/>` + wolf + trees
  },
  stadium(W, H, p, r) {
    let crowd = ''
    for (let i = 0; i < 400; i++) crowd += `<circle cx="${r() * W}" cy="${H * 0.3 + r() * H * 0.2}" r="2" fill="${r() < 0.5 ? p[2] : '#fff'}" opacity="${r() * 0.6}"/>`
    const lights = [0.12, 0.88].map((x) => glow(W * x, H * 0.1, 180, '#fff', 0.8) + `<rect x="${W * x - 30}" y="${H * 0.08}" width="60" height="18" fill="#fff"/>`).join('')
    return sky(W, H, p) + lights + crowd +
      `<path d="M${-W * 0.2} ${H} L${W * 0.1} ${H * 0.5} L${W * 0.9} ${H * 0.5} L${W * 1.2} ${H} Z" fill="${p[1]}"/>
       <path d="M${W * 0.5} ${H * 0.5} L${W * 0.5} ${H}" stroke="#fff" stroke-width="4" opacity="0.6"/>
       <ellipse cx="${W * 0.5}" cy="${H * 0.68}" rx="${W * 0.22}" ry="${H * 0.06}" fill="none" stroke="#fff" stroke-width="4" opacity="0.6"/>
       <circle cx="${W * 0.62}" cy="${H * 0.78}" r="${W * 0.07}" fill="#fff"/><path d="M${W * 0.62} ${H * 0.74} l18 12 -7 20 h-22 l-7 -20 z" fill="#111"/>
       <path d="M${W * 0.3} ${H * 0.34} L${W * 0.42} ${H * 0.34} L${W * 0.34} ${H * 0.46} L${W * 0.48} ${H * 0.46} L${W * 0.26} ${H * 0.64} L${W * 0.34} ${H * 0.5} L${W * 0.22} ${H * 0.5} Z" fill="${p[2]}"/>`
  },
  western(W, H, p, r) {
    const mesa = (x, w, h, c) => `<path d="M${x} ${H * 0.8} L${x + w * 0.1} ${H * 0.8 - h} L${x + w * 0.9} ${H * 0.8 - h} L${x + w} ${H * 0.8} Z" fill="${c}"/>`
    return sky(W, H, [p[0], p[1]]) + `<circle cx="${W * 0.5}" cy="${H * 0.58}" r="${W * 0.28}" fill="${p[2]}"/>` + glow(W * 0.5, H * 0.58, W * 0.7, p[2], 0.6) +
      mesa(-W * 0.1, W * 0.5, H * 0.2, '#7a2e10') + mesa(W * 0.55, W * 0.6, H * 0.26, '#5a200a') + `<rect y="${H * 0.8}" width="${W}" height="${H * 0.2}" fill="${p[3]}"/>` +
      `<path d="M${W * 0.47} ${H * 0.8} l4 -70 l-14 -6 l10 -40 h20 l10 40 l-14 6 l4 70 z" fill="${p[3]}"/><rect x="${W * 0.455}" y="${H * 0.8 - 128}" width="34" height="8" fill="${p[3]}"/><rect x="${W * 0.465}" y="${H * 0.8 - 140}" width="16" height="14" fill="${p[3]}"/>`
  },
  mecha(W, H, p, r) {
    const cx = W / 2, cy = H * 0.45
    let lines = ''
    for (let i = 0; i < 30; i++) lines += `<line x1="${cx}" y1="${cy}" x2="${r() * W * 2 - W / 2}" y2="${r() < 0.5 ? 0 : H}" stroke="${p[3]}" stroke-width="1" opacity="${0.1 + r() * 0.2}"/>`
    const mech = `<polygon points="${cx - 70},${cy - 80} ${cx + 70},${cy - 80} ${cx + 100},${cy + 20} ${cx + 60},${cy + 90} ${cx - 60},${cy + 90} ${cx - 100},${cy + 20}" fill="#1a2238" stroke="${p[3]}" stroke-width="4"/>
      <polygon points="${cx - 40},${cy - 140} ${cx + 40},${cy - 140} ${cx + 30},${cy - 85} ${cx - 30},${cy - 85}" fill="#1a2238" stroke="${p[3]}" stroke-width="4"/>
      <rect x="${cx - 26}" y="${cy - 122}" width="52" height="10" fill="${p[2]}"/>
      <polygon points="${cx - 100},${cy - 60} ${cx - 190},${cy - 10} ${cx - 170},${cy + 70} ${cx - 110},${cy + 20}" fill="#121a2e" stroke="${p[3]}" stroke-width="3"/>
      <polygon points="${cx + 100},${cy - 60} ${cx + 190},${cy - 10} ${cx + 170},${cy + 70} ${cx + 110},${cy + 20}" fill="#121a2e" stroke="${p[3]}" stroke-width="3"/>
      <circle cx="${cx}" cy="${cy}" r="20" fill="${p[2]}"/>`
    return sky(W, H, p) + lines + glow(cx, cy, W * 0.6, p[2], 0.4) + mech + ridge(W, H, r, H * 0.85, 40, '#05070f', 9)
  },
  cubes(W, H, p, r) {
    let cubes = ''
    const cube = (x, y, s, c) => `<polygon points="${x},${y} ${x + s},${y - s / 2} ${x + 2 * s},${y} ${x + s},${y + s / 2}" fill="${c}"/>
      <polygon points="${x},${y} ${x + s},${y + s / 2} ${x + s},${y + 1.5 * s} ${x},${y + s}" fill="${c}" opacity="0.75"/>
      <polygon points="${x + 2 * s},${y} ${x + s},${y + s / 2} ${x + s},${y + 1.5 * s} ${x + 2 * s},${y + s}" fill="${c}" opacity="0.5"/>`
    for (let i = 0; i < 14; i++) cubes += cube(r() * W * 0.85, H * (0.12 + r() * 0.6), 24 + r() * 50, r() < 0.5 ? p[2] : p[3])
    return sky(W, H, p) + cubes + `<circle cx="${W * 0.5}" cy="${H * 0.42}" r="${W * 0.22}" fill="none" stroke="${p[2]}" stroke-width="3" stroke-dasharray="4 10"/>`
  },
  samurai(W, H, p, r) {
    let petals = ''
    for (let i = 0; i < 50; i++) petals += `<ellipse cx="${r() * W}" cy="${r() * H}" rx="6" ry="3" fill="#e85d75" opacity="${0.4 + r() * 0.6}" transform="rotate(${r() * 180} ${r() * W} ${r() * H})"/>`
    const fig = `<path d="M${W * 0.5} ${H * 0.4} l-24 20 -40 150 h128 l-40 -150 z" fill="${p[3]}"/><circle cx="${W * 0.5}" cy="${H * 0.385}" r="20" fill="${p[3]}"/>
      <path d="M${W * 0.44} ${H * 0.37} L${W * 0.5} ${H * 0.34} L${W * 0.56} ${H * 0.37} Z" fill="${p[3]}"/>
      <line x1="${W * 0.36}" y1="${H * 0.33}" x2="${W * 0.62}" y2="${H * 0.62}" stroke="${p[3]}" stroke-width="5"/>`
    return sky(W, H, p) + `<circle cx="${W * 0.5}" cy="${H * 0.42}" r="${W * 0.32}" fill="${p[2]}"/>` +
      ridge(W, H, r, H * 0.7, H * 0.18, '#7d5a48', 6, 0.5) + fig + `<rect y="${H * 0.69}" width="${W}" height="${H * 0.31}" fill="${p[3]}"/>` + petals
  },
  reef(W, H, p, r) {
    let coral = '', fish = '', rays = ''
    for (let i = 0; i < 8; i++) rays += `<path d="M${W * (i / 8)} 0 L${W * (i / 8) - 60} ${H} L${W * (i / 8) - 20} ${H} Z" fill="#fff" opacity="0.06"/>`
    for (let i = 0; i < 14; i++) {
      const x = r() * W, h = 60 + r() * 140
      coral += `<path d="M${x} ${H} C${x - 30} ${H - h / 2} ${x + 30} ${H - h} ${x} ${H - h} C${x - 20} ${H - h} ${x + 40} ${H - h / 2} ${x + 20} ${H} Z" fill="${r() < 0.5 ? p[2] : p[3]}"/>`
    }
    for (let i = 0; i < 9; i++) {
      const x = r() * W, y = H * (0.2 + r() * 0.5), s = 14 + r() * 16
      fish += `<ellipse cx="${x}" cy="${y}" rx="${s}" ry="${s / 2}" fill="${p[3]}"/><path d="M${x + s} ${y} l${s / 1.5} ${-s / 2} v${s} z" fill="${p[3]}"/>`
    }
    return sky(W, H, p) + rays + fish + `<path d="M${W * 0.3} ${H * 0.72} L${W * 0.35} ${H * 0.55} L${W * 0.42} ${H * 0.6} L${W * 0.5} ${H * 0.45} L${W * 0.58} ${H * 0.6} L${W * 0.65} ${H * 0.55} L${W * 0.7} ${H * 0.72} Z" fill="#0b4d6e" opacity="0.8"/>` + coral
  },
  giftcard(W, H, p, r) {
    let rings = ''
    for (let i = 0; i < 6; i++) rings += `<circle cx="${W * 0.85}" cy="${H * 0.15}" r="${60 + i * 70}" fill="none" stroke="${p[2]}" stroke-width="2" opacity="${0.35 - i * 0.05}"/>`
    return sky(W, H, p) + rings + glow(W * 0.2, H * 0.9, W * 0.8, p[2], 0.3) +
      `<rect x="${W * 0.12}" y="${H * 0.22}" width="${W * 0.76}" height="${W * 0.48}" fill="${p[1]}" stroke="${p[2]}" stroke-width="4"/>
       <rect x="${W * 0.12}" y="${H * 0.22 + W * 0.1}" width="${W * 0.76}" height="22" fill="${p[2]}"/>`
  },
}
