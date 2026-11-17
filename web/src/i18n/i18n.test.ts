import { expect, it } from 'vitest'
import { DICTS } from './dict'
import { translate } from './useI18n'

it('falls back to English and fills placeholders', () => {
  expect(translate('lt', 'A text nobody translated')).toBe('A text nobody translated')
  expect(translate('en', 'Only {n} left', { n: 3 })).toBe('Only 3 left')
})

it('every translation keeps the same placeholders as its English key', () => {
  for (const [lang, dict] of Object.entries(DICTS)) {
    for (const [en, tr] of Object.entries(dict)) {
      const want = (en.match(/\{\w+\}/g) ?? []).sort().join()
      const got = (tr.match(/\{\w+\}/g) ?? []).sort().join()
      expect(got, `${lang}: "${en}"`).toBe(want)
    }
  }
})
