import { describe, expect, it } from 'vitest'
import de from './dict/de'
import lt from './dict/lt'
import pl from './dict/pl'

// Every source file except tests and the dictionaries themselves, read as plain text.
const sources = import.meta.glob<string>(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!./dict/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

// t('…') / t("…") with a string literal as the first argument (also when it is split over lines).
const CALL = /\bt\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1\s*[,)]/g

function keysIn(code: string): string[] {
  return [...code.matchAll(CALL)].map((m) => (m[2] ?? '').replace(/\\(.)/g, '$1'))
}

const used = new Map<string, string>() // key → first file that uses it
for (const [file, code] of Object.entries(sources)) {
  for (const key of keysIn(code)) if (!used.has(key)) used.set(key, file)
}

describe('translation coverage', () => {
  it('finds the t() calls in the source', () => {
    expect(keysIn(`t('Only {n} left', { n: 3 }) + t(\n  "Cart",\n)`)).toEqual(['Only {n} left', 'Cart'])
    expect(used.size).toBeGreaterThan(100)
  })

  for (const [lang, dict] of Object.entries({ lt, de, pl })) {
    it(`${lang} translates every t() key`, () => {
      const missing = [...used].filter(([key]) => !(key in dict)).map(([key, file]) => `${key}  (${file})`)
      expect(missing, `missing ${lang} translations`).toEqual([])
    })
  }
})
