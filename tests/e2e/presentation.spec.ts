import { expect, test, type Page } from '@playwright/test'

async function enter(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter the city' }).first().click()
  await expect(page.locator('.city-map-canvas canvas')).toBeVisible()
}
async function saved(page: Page) {
  return page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('crown-and-capital:local:v1')!).session
    return { revision: session.revision as number, dice: session.lastRoll as { first: number; second: number; total: number }, position: session.game.players['player-1'].position as number, receipts: session.receipts.length as number, cash: session.game.players['player-1'].cash as number }
  })
}

test('confirmed dice precede the landing; skipping cannot replay a roll or payment', async ({ page }, testInfo) => {
  await enter(page)
  await page.getByRole('button', { name: /Roll the dice/ }).click()
  await expect(page.getByText('Rolling dice', { exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const committed = await saved(page)
  expect(committed.revision).toBe(1)
  expect(committed.position).toBe(committed.dice.total)
  await page.getByRole('button', { name: 'Skip animation →', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.locator('.dice-tray__result')).toHaveText(`Dice: ${committed.dice.first} and ${committed.dice.second}. Total: ${committed.dice.total}.`)
  expect(await saved(page)).toEqual(committed)
  await page.screenshot({ path: testInfo.outputPath('confirmed-landing.png'), fullPage: true })
  await page.reload()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Rolling dice', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'City commentary' })).toHaveCount(0)
  expect(await saved(page)).toEqual(committed)
})

test('natural dice and route sequence finishes, manual camera suspends follow and can return', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await enter(page)
  await page.screenshot({ path: testInfo.outputPath('tabletop-overview.png') })
  await page.getByRole('button', { name: /Roll the dice/ }).click()
  await expect(page.locator('.turn-action')).toContainText('Following the route')
  await expect(page.getByRole('dialog')).toBeVisible()
  const pass = page.getByRole('button', { name: 'Pass', exact: true })
  if (await pass.count()) await pass.click()
  else await page.getByRole('button', { name: /End turn/ }).click()
  const canvas = page.locator('.city-map-canvas canvas')
  await canvas.hover()
  await page.mouse.wheel(0, -80)
  await expect(page.getByRole('button', { name: 'Camera follow off', exact: true })).toHaveAttribute('aria-pressed', 'false')
  const manualZoom = await page.locator('.map-status').textContent()
  await page.getByRole('button', { name: 'Return to active player ↗', exact: true }).click()
  await expect(page.locator('.map-status')).toHaveText(manualZoom!)
  await expect(page.getByRole('button', { name: 'Camera follow off', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Reset zoom', exact: true }).click()
  await expect(page.locator('.map-status')).toContainText('1.0×')
  await expect(canvas).toHaveCount(1)
  await page.getByRole('button', { name: 'Return to active player ↗', exact: true }).click()
  await expect(page.locator('.map-status')).toContainText('7.0×')
  await page.waitForTimeout(550)
  await page.screenshot({ path: testInfo.outputPath('tabletop-active-player.png') })
})

test('disabled WebGL, reduced motion, keyboard and stored fast-resolution preferences work', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof original>) {
      if (String(args[0]).includes('webgl')) return null
      return original.apply(this, args)
    } as typeof original
  })
  await enter(page)
  await page.getByRole('button', { name: 'Fast resolution off', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Fast resolution on', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: /Roll the dice/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.locator('.dice-tray__cube--rolling')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Skip animation →', exact: true })).toHaveCount(0)
  const committed = await saved(page)
  await page.screenshot({ path: testInfo.outputPath('tabletop-mobile-reduced-motion.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Fast resolution on', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await saved(page)).toEqual(committed)
})
