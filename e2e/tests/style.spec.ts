import { expect, test } from '@playwright/test'

// Guards against drifting away from the measured Eneba design tokens.
test('Eneba design tokens are applied', async ({ page }) => {
  await page.goto('/store')
  await expect(page.locator('main a[href^="/p/"]').first()).toBeVisible()
  const s = await page.evaluate(() => {
    const css = (el: Element | null, prop: string) => (el ? getComputedStyle(el).getPropertyValue(prop) : null)
    const card = document.querySelector('main a[href^="/p/"]')
    return {
      bodyBg: css(document.body, 'background-color'),
      font: css(document.body, 'font-family'),
      cardBg: css(card, 'background-color'),
      cardRadius: css(card, 'border-radius'),
      headerTop: document.querySelector('header')?.firstElementChild?.getBoundingClientRect().height,
      nav: css(document.querySelector('header nav'), 'background-color'),
      navHeight: document.querySelector('header nav')?.getBoundingClientRect().height,
    }
  })
  expect(s.bodyBg).toBe('rgb(70, 24, 172)') // #4618AC
  expect(s.font).toContain('Metropolis')
  expect(s.cardBg).toBe('rgb(31, 10, 77)') // #1F0A4D
  expect(s.cardRadius).toBe('0px')
  expect(s.headerTop).toBe(97) // 57px search row + 20px padding top/bottom
  expect(s.nav).toBe('rgba(0, 0, 0, 0.25)')
  expect(s.navHeight).toBe(50)

  await page.goto('/p/starfall-odyssey-steam-global')
  const buy = page.getByRole('button', { name: /^Buy now/ }).first()
  await expect(buy).toHaveCSS('background-color', 'rgb(250, 211, 24)') // #FAD318
  await expect(buy).toHaveCSS('color', 'rgb(0, 0, 0)')
  await expect(buy).toHaveCSS('border-radius', '0px')
})
