import { expect, it } from 'vitest'
import { safeNext } from './safeNext'

it('allows only same-site redirect paths', () => {
  expect(safeNext('/checkout')).toBe('/checkout')
  expect(safeNext('/store?q=a')).toBe('/store?q=a')
  expect(safeNext(null)).toBe('/')
  expect(safeNext('https://evil.example')).toBe('/')
  expect(safeNext('//evil.example')).toBe('/')
  expect(safeNext('/\\evil.example')).toBe('/')
  expect(safeNext('javascript:alert(1)')).toBe('/')
})
