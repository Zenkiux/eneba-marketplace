# Third-party assets

## Metropolis font

- **Font:** Metropolis, by Chris Simpson. Weights used: 400, 600, 700, 800 (latin subset, normal style).
- **Delivered through:** the npm package [`@fontsource/metropolis`](https://www.npmjs.com/package/@fontsource/metropolis) 5.3.0 (font version v11.0.0). The font files are self-hosted: Vite bundles them from `node_modules` at build time; no request goes to a font CDN.
- **Licence:** the Fontsource package (`node_modules/@fontsource/metropolis/metadata.json` and `LICENSE`) ships the font under **The Unlicense** (public-domain dedication), with attribution to Chris Simpson and source <https://github.com/dw5/Metropolis> (licence text: <https://github.com/dw5/Metropolis/blob/master/UNLICENSE>).
  - Note: earlier Metropolis releases were published under the SIL Open Font License 1.1, which is what `docs/eneba-design-reference.md` mentions. The version we actually bundle is the Unlicense release. Both licences permit self-hosting and bundling in a commercial or non-commercial web app; the Unlicense has no attribution requirement, but we credit the author here anyway.
- **Loaded in:** `src/styles/global.css` (`@fontsource/metropolis/{400,600,700,800}.css`).

## Icons

- [`lucide-react`](https://lucide.dev) — ISC licence.
