import { beforeEach, describe, expect, it } from 'vitest'
import { guestCart, MAX_QUANTITY } from './guestCart'

describe('guest cart', () => {
  beforeEach(() => {
    localStorage.clear()
    guestCart.clear()
  })

  it('adds the same offer once and increases its quantity', () => {
    guestCart.add(7, 1)
    guestCart.add(7, 2)
    guestCart.add(9, 1)
    expect(guestCart.get()).toEqual([
      { offerId: 7, quantity: 3 },
      { offerId: 9, quantity: 1 },
    ])
  })

  it('never exceeds visible stock or the per-line maximum', () => {
    guestCart.add(1, 5, 2)
    expect(guestCart.get()[0]?.quantity).toBe(2)
    guestCart.add(2, 50)
    expect(guestCart.get()[1]?.quantity).toBe(MAX_QUANTITY)
  })

  it('persists only offer ids and quantities', () => {
    guestCart.add(3, 1)
    expect(JSON.parse(localStorage.getItem('keyshop.cart.v1') ?? '')).toEqual([{ offerId: 3, quantity: 1 }])
  })

  it('removes lines and clamps manual quantities', () => {
    guestCart.add(4, 1)
    guestCart.set(4, 0)
    expect(guestCart.get()[0]?.quantity).toBe(1)
    guestCart.remove(4)
    expect(guestCart.get()).toEqual([])
  })
})
