import { expect, test, type Page } from '@playwright/test'

async function enterMobile(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter the city' }).first().click()
  await expect(page.getByRole('heading', { name: 'THE CITY, in play.' })).toBeVisible()
  const onboarding = page.getByRole('dialog', { name: /Welcome to Crown & Capital|Read the table|Choose your table/ })
  await expect(onboarding).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(onboarding).not.toBeVisible()
}

test('mobile turn guidance stays visible inside the fixed action bar', async ({ page }) => {
  await enterMobile(page)
  const guidance = page.locator('.turn-action > p[role="status"]')
  await expect(guidance).toBeVisible()
  await expect(guidance).toContainText('is at the desk. Roll when ready.')
  await page.getByRole('button', { name: /Roll the dice/ }).click()
  await expect(guidance).toBeVisible()
  await expect(guidance).toHaveText(/dice are on the table|Following the route|Landing settled|Choose whether|Auction live/)
  const guidanceBox = await guidance.boundingBox()
  const barBox = await page.locator('.turn-action').boundingBox()
  expect(guidanceBox!.y).toBeGreaterThanOrEqual(barBox!.y)
  expect(guidanceBox!.y + guidanceBox!.height).toBeLessThanOrEqual(barBox!.y + barBox!.height + 1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('map directory and the end of the page stay reachable above the fixed action bar', async ({ page }) => {
  await enterMobile(page)
  const summary = page.locator('.map-directory > summary')
  const bar = page.locator('.turn-action')
  await expect(summary).toBeVisible()
  const barBox = await bar.boundingBox()
  // scroll-into-view must reserve the action-bar clearance for the directory
  const scrollMargin = await summary.evaluate(el => parseFloat(getComputedStyle(el).scrollMarginBottom))
  expect(scrollMargin).toBeGreaterThanOrEqual(barBox!.height)

  await summary.scrollIntoViewIfNeeded()
  const summaryBox = await summary.boundingBox()
  expect(summaryBox!.y + summaryBox!.height).toBeLessThanOrEqual(barBox!.y)
  const covered = await page.evaluate(() => {
    const summary = document.querySelector('.map-directory > summary')!
    const rect = summary.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    return !(hit === summary || summary.contains(hit))
  })
  expect(covered).toBe(false)
  await summary.click()
  await expect(page.locator('.map-directory')).toHaveJSProperty('open', true)
  await expect(page.getByRole('searchbox', { name: 'Find a deed or stop' })).toBeVisible()

  // the page bottom padding keeps the last panel clear of the bar at full scroll
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
  await page.waitForTimeout(150)
  const pageEnd = await page.evaluate(() => ({
    panelBottom: document.querySelector('.command-panel')!.getBoundingClientRect().bottom,
    barTop: document.querySelector('.turn-action')!.getBoundingClientRect().top,
  }))
  expect(pageEnd.panelBottom).toBeLessThanOrEqual(pageEnd.barTop)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('turn and room chip remains visible in the mobile topbar', async ({ page }) => {
  await enterMobile(page)
  const chip = page.locator('.match-pill')
  await expect(chip).toBeVisible()
  await expect(chip).toContainText('TURN')
  const chipBox = await chip.boundingBox()
  const topbarBox = await page.locator('.game-topbar').boundingBox()
  expect(chipBox!.y).toBeGreaterThanOrEqual(topbarBox!.y - 1)
  expect(chipBox!.y + chipBox!.height).toBeLessThanOrEqual(topbarBox!.y + topbarBox!.height + 1)
  expect(chipBox!.x).toBeGreaterThanOrEqual(0)
  expect(chipBox!.x + chipBox!.width).toBeLessThanOrEqual(390)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

async function measureControl(page: Page, selector: string) {
  return page.evaluate(sel => {
    const shape = { found: false, disabled: false, label: '', ratio: 0, alpha: 0, opacity: '', color: '', background: '' }
    const el = document.querySelector<HTMLElement>(sel)
    if (!el) return shape
    const cs = getComputedStyle(el)
    const channels = (value: string) => value.match(/[\d.]+/g)!.map(Number)
    const linear = (value: number) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
    const luminance = ([r, g, b]: number[]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
    const text = channels(cs.color)
    const background = channels(cs.backgroundColor)
    const alpha = background.length > 3 ? background[3] : 1
    const [light, dark] = [luminance(text.slice(0, 3)), luminance(background.slice(0, 3))].sort((a, b) => b - a)
    return {
      found: true,
      disabled: (el as HTMLButtonElement).disabled ?? false,
      label: (el.textContent ?? '').trim().slice(0, 40),
      ratio: Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100,
      alpha,
      opacity: cs.opacity,
      color: cs.color,
      background: cs.backgroundColor,
    } as const
  }, selector)
}

test('primary and disabled action text both clear AA contrast without opacity fades', async ({ page }) => {
  await enterMobile(page)
  const enabled = await measureControl(page, '.turn-action .roll-button')
  expect(enabled.found).toBe(true)
  expect(enabled.disabled).toBe(false)
  expect(enabled.opacity).toBe('1')
  expect(enabled.alpha).toBe(1)
  expect(enabled.ratio).toBeGreaterThanOrEqual(4.5)

  await page.getByRole('button', { name: 'City exchange' }).click()
  await expect(page.locator('.economy-desk .primary-button').first()).toBeDisabled()
  const disabled = await measureControl(page, '.economy-desk .primary-button')
  expect(disabled.disabled).toBe(true)
  expect(disabled.label).toContain('Build factory')
  expect(disabled.opacity).toBe('1')
  expect(disabled.alpha).toBe(1)
  expect(disabled.ratio).toBeGreaterThanOrEqual(4.5)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
