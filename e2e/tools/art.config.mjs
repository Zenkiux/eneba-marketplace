// Art direction for every fictional title and banner. The renderer turns each entry into an
// original cover (600×900) or banner image. No third-party artwork is used.
//
// motif: which generated scene to draw. palette: [sky/top, sky/bottom, accent, highlight].

export const covers = [
  { slug: 'starfall-odyssey', title: 'Starfall', sub: 'Odyssey', studio: 'Lumen Forge', motif: 'space', palette: ['#0b0630', '#3b1a8f', '#ff7ad9', '#ffd36e'] },
  { slug: 'neon-drift-racing', title: 'Neon Drift', sub: 'Racing', studio: 'Overclock Studio', motif: 'neon', palette: ['#12002b', '#5b0a7a', '#ff2fb3', '#26f0ff'] },
  { slug: 'hollow-crown', title: 'Hollow Crown', sub: 'Ashes of the Realm', studio: 'Greyward Games', motif: 'ember', palette: ['#120404', '#5c1208', '#ff6a1a', '#ffc46b'] },
  { slug: 'iron-tide-tactics', title: 'Iron Tide', sub: 'Tactics', studio: 'Bastion Labs', motif: 'ocean', palette: ['#0a1a2e', '#1f4f7a', '#f2b33d', '#cfe8ff'] },
  { slug: 'pixel-pioneers', title: 'Pixel Pioneers', sub: '', studio: 'Tiny Lantern', motif: 'pixel', palette: ['#4fb3ff', '#a6e1ff', '#5ac25a', '#ffd84d'] },
  { slug: 'frostbound', title: 'Frostbound', sub: '', studio: 'Polar Night Studio', motif: 'snow', palette: ['#0d1b33', '#5d86b8', '#e9f4ff', '#8fd3ff'] },
  { slug: 'velvet-heist', title: 'Velvet Heist', sub: '', studio: 'Silk Road Games', motif: 'noir', palette: ['#14010c', '#5a0f3a', '#ff3d6e', '#f7d68b'] },
  { slug: 'echoes-of-aether', title: 'Echoes', sub: 'of Aether', studio: 'Lumen Forge', motif: 'lighthouse', palette: ['#1b2a4a', '#f29e7d', '#fff1c9', '#6fd1c4'] },
  { slug: 'kingdom-forge-2', title: 'Kingdom Forge', sub: 'II', studio: 'Ironbark Studios', motif: 'castle', palette: ['#2a1a4a', '#d9895b', '#ffe3a3', '#5a3d2b'] },
  { slug: 'shadow-protocol', title: 'Shadow Protocol', sub: 'Black Sky', studio: 'Vector Nine', motif: 'tactical', palette: ['#050608', '#1d2733', '#ff5a1f', '#9fb3c8'] },
  { slug: 'tiny-farm-valley', title: 'Tiny Farm', sub: 'Valley', studio: 'Meadowlight', motif: 'farm', palette: ['#7cc8ff', '#d6f0ff', '#6cbf4a', '#ffcf4d'] },
  { slug: 'abyssal-depths', title: 'Abyssal', sub: 'Depths', studio: 'Pressure Point', motif: 'abyss', palette: ['#00040a', '#032a3a', '#28e0c8', '#ff4d4d'] },
  { slug: 'galactic-trade-union', title: 'Galactic', sub: 'Trade Union', studio: 'Orbital Ledger', motif: 'space', palette: ['#030a1c', '#0f3b5e', '#38e1a8', '#ffe066'] },
  { slug: 'skyline-architect', title: 'Skyline', sub: 'Architect', studio: 'Blueprint Collective', motif: 'city', palette: ['#0e2a52', '#ff9e5e', '#ffd9a8', '#1a1430'] },
  { slug: 'wildfang-legends', title: 'Wildfang', sub: 'Legends', studio: 'Ember Peak', motif: 'wilds', palette: ['#1a2b3d', '#f08a4b', '#2e5a3a', '#ffe1a8'] },
  { slug: 'moonlit-detective', title: 'Moonlit', sub: 'Detective Agency', studio: 'Inkwell & Co', motif: 'noir', palette: ['#03060f', '#1c2b4f', '#e8e2c9', '#ffcc4d'] },
  { slug: 'thunder-arena-football-27', title: 'Thunder Arena', sub: 'Football 27', studio: 'Pitchside Interactive', motif: 'stadium', palette: ['#06142b', '#0c5c3a', '#ffe600', '#ffffff'] },
  { slug: 'dust-and-revolver', title: 'Dust & Revolver', sub: '', studio: 'High Noon Works', motif: 'western', palette: ['#3a1305', '#f2853a', '#ffd27a', '#2a0d05'] },
  { slug: 'mecha-vanguard-zero', title: 'Mecha Vanguard', sub: 'Zero', studio: 'Steel Lotus', motif: 'mecha', palette: ['#0a0f1f', '#22305a', '#ff3b3b', '#7ad7ff'] },
  { slug: 'quantum-puzzle-lab', title: 'Quantum', sub: 'Puzzle Lab', studio: 'Small Constant', motif: 'cubes', palette: ['#f4f1ff', '#c9bfff', '#6b4dff', '#ff8f6b'] },
  { slug: 'crimson-samurai', title: 'Crimson Samurai', sub: 'Chronicles', studio: 'Red Lantern', motif: 'samurai', palette: ['#f3e3c8', '#e8b98a', '#c8102e', '#1a0f0a'] },
  { slug: 'coral-kingdom', title: 'Coral', sub: 'Kingdom', studio: 'Bluefin Studio', motif: 'reef', palette: ['#0569a8', '#29c4d6', '#ff7aa8', '#ffe066'] },
  { slug: 'starfall-odyssey-void-expansion', title: 'Starfall', sub: 'Void Expansion', studio: 'Lumen Forge', motif: 'space', palette: ['#000000', '#1b0a3d', '#9d5cff', '#4dffe1'], badge: 'DLC' },
  { slug: 'hollow-crown-season-pass', title: 'Hollow Crown', sub: 'Season Pass', studio: 'Greyward Games', motif: 'ember', palette: ['#0a0a12', '#2b1a40', '#c56bff', '#ffc46b'], badge: 'DLC' },
  { slug: 'keyshop-gift-card-10', title: 'keyshop', sub: 'Gift Card', value: '10 EUR', motif: 'giftcard', palette: ['#4618ac', '#2a0e70', '#fad318', '#ffffff'] },
  { slug: 'keyshop-gift-card-25', title: 'keyshop', sub: 'Gift Card', value: '25 EUR', motif: 'giftcard', palette: ['#1f0a4d', '#4618ac', '#84e916', '#ffffff'] },
  { slug: 'arcadia-pass-3-months', title: 'Arcadia', sub: 'Pass', value: '3 months', motif: 'giftcard', palette: ['#0f3d3a', '#0a1f2e', '#4dffc3', '#ffffff'] },
]

// Banners reuse a cover's scene at a wide size; text is part of the image like Eneba's banners.
export const banners = [
  { file: 'crimson-samurai', w: 1200, h: 520, from: 'crimson-samurai', headline: 'Crimson Samurai Chronicles', kicker: 'Pre-order now', cta: 'Pre-order' },
  { file: 'winter-sale', w: 1200, h: 520, from: 'frostbound', headline: 'Winter Sale', kicker: 'Up to -60% on hundreds of keys', cta: 'See the deals' },
  { file: 'shadow-protocol', w: 400, h: 520, from: 'shadow-protocol', headline: 'Shadow Protocol', kicker: 'From top-rated sellers', cta: 'Buy now' },
  { file: 'cosy-games', w: 400, h: 520, from: 'tiny-farm-valley', headline: 'Cosy games', kicker: 'Under 20 EUR', cta: 'Browse' },
  { file: 'gift-cards', w: 400, h: 520, from: 'keyshop-gift-card-10', headline: 'Gift cards', kicker: 'The easy gift for any gamer', cta: 'Shop now' },
]
