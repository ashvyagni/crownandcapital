import { expect, test, type Page } from '@playwright/test'

async function enter(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter the city' }).first().click()
  await expect(page.getByRole('heading', { name: 'THE CITY, in play.' })).toBeVisible()
}

async function findAvailableDeed(page: Page) {
  for (let turn = 0; turn < 16; turn++) {
    await page.getByRole('button', { name: /Roll the dice/ }).click()
    const card = page.getByRole('dialog')
    await expect(card).toBeVisible()
    if (await card.getByRole('button', { name: /Acquire/ }).count()) return card
    await card.getByRole('button', { name: /End turn/ }).click()
  }
  throw new Error('Seeded table did not reach an available deed')
}

test('quick play opens a real four-seat table and renders the board', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await enter(page)
  await expect(page.getByRole('heading', { name: '4 seats live' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByRole('button', { name: /Roll the dice/ })).toBeEnabled()
  await page.waitForTimeout(400)
  expect(errors).toEqual([])
})

test('plus opens setup, adds a chosen character and updates the real roster', async ({ page }) => {
  await enter(page)
  await page.getByRole('button', { name: 'Add a player' }).click()
  const setup = page.getByRole('dialog', { name: 'Set your table' })
  await setup.getByRole('textbox', { name: 'New player name' }).fill('Quinn')
  await setup.getByLabel('New player character').selectOption('4')
  await setup.getByRole('button', { name: 'Add player', exact: true }).click()
  await expect(setup.getByRole('textbox', { name: 'Player 5 name' })).toHaveValue('Quinn')
  await setup.getByRole('button', { name: /Enter the city/ }).click()
  await expect(page.getByRole('heading', { name: '5 seats live' })).toBeVisible()
  await expect(page.locator('.roster').getByText('Quinn', { exact: true })).toBeVisible()
  await expect(page.locator('.roster .player-row').last().getByRole('img')).toHaveAttribute('aria-label', /Magnate/)
  await page.getByRole('button', { name: /Roll the dice/ }).click()
  await expect(page.getByRole('button', { name: 'Add a player' })).toBeDisabled()
})

test('setup rejects duplicate names, supports twenty seats, and preserves cancelled choices', async ({ page }) => {
  await enter(page)
  await page.getByRole('button', { name: 'Add a player' }).click()
  const setup = page.getByRole('dialog')
  await setup.getByRole('textbox', { name: 'New player name' }).fill(' avery vale ')
  await setup.getByRole('button', { name: 'Add player', exact: true }).click()
  await expect(setup.getByRole('alert')).toContainText('unique')
  for (let seat = 5; seat <= 20; seat++) {
    await setup.getByRole('textbox', { name: 'New player name' }).fill(`Trader ${seat}`)
    await setup.getByRole('button', { name: 'Add player', exact: true }).click()
  }
  await expect(setup.getByRole('button', { name: 'Add player', exact: true })).toBeDisabled()
  await setup.getByRole('button', { name: /Enter the city/ }).click()
  await expect(page.getByRole('heading', { name: '20 seats live' })).toBeVisible()
  await page.getByRole('button', { name: 'Add a player' }).click()
  await page.getByLabel('Player 1 character', { exact: true }).selectOption('5')
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.locator('.roster .player-row').first().getByRole('img')).toHaveAttribute('aria-label', /Architect/)
})

test('landings lock the turn; buying, mortgaging and redemption update the same card', async ({ page }) => {
  await enter(page)
  const card = await findAvailableDeed(page)
  await expect(page.getByRole('button', { name: /Roll the dice/ })).toBeDisabled()
  const title = await card.getByRole('heading').textContent()
  await page.keyboard.press('Escape')
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: /Acquire/ }).click()
  await expect(card.getByText(/Your deed/)).toBeVisible()
  await expect(card.getByRole('heading')).toHaveText(title!)
  await card.getByRole('button', { name: /^Mortgage ·/ }).click()
  await expect(card.getByRole('button', { name: /^Redeem ·/ })).toBeEnabled()
  await expect(card.getByRole('button', { name: /^Mortgage ·/ })).toBeDisabled()
  await card.getByRole('button', { name: /^Redeem ·/ }).click()
  await expect(card.getByRole('button', { name: /^Mortgage ·/ })).toBeEnabled()
  await card.getByRole('button', { name: /End turn/ }).click()
  await expect(card).not.toBeVisible()
  await expect(page.locator('.ledger-preview')).toContainText('unmortgage')
  await expect(page.getByRole('button', { name: /Roll the dice/ })).toBeEnabled()
})

test('sell confirmation can be cancelled and bank sale removes the owned deed', async ({ page }) => {
  await enter(page)
  const card = await findAvailableDeed(page)
  await card.getByRole('button', { name: /Acquire/ }).click()
  await card.getByRole('button', { name: /^Sell to bank/ }).click()
  await card.getByRole('button', { name: 'Keep deed' }).click()
  await expect(card.getByText(/Your deed/)).toBeVisible()
  await card.getByRole('button', { name: /^Sell to bank/ }).click()
  await card.getByRole('button', { name: 'Confirm sale' }).click()
  await expect(card.getByText(/Bank-owned/)).toBeVisible()
  await expect(card.getByRole('button', { name: /Acquire/ })).toHaveCount(0)
  await card.getByRole('button', { name: /End turn/ }).click()
  await expect(page.locator('.ledger-preview')).toContainText('sale')
})

test('passing is free and resolves only the pending turn', async ({ page }) => {
  await enter(page)
  const card = await findAvailableDeed(page)
  const title = await card.getByRole('heading').textContent()
  await card.getByRole('button', { name: 'Pass', exact: true }).click()
  await expect(card).not.toBeVisible()
  await expect(page.locator('.ledger-preview')).not.toContainText('purchase')
  await expect(page.locator('.inspector')).toContainText(title!)
  await expect(page.locator('.inspector')).toContainText('Owner: Bank')
})

test('space directory exposes real deed names and prices and focuses detailed board view', async ({ page }) => {
  await enter(page)
  await page.getByText('Browse all 144 spaces', { exact: true }).click()
  await page.getByRole('searchbox', { name: 'Find a deed or stop' }).fill('Crown Heights Arcade')
  const deed = page.locator('.map-directory-list').getByRole('button')
  await expect(deed).toHaveCount(1)
  await expect(deed).toContainText('CR 130')
  await deed.click()
  await expect(page.locator('.inspector')).toContainText('Crown Heights Arcade')
  await expect(page.locator('.map-status')).toContainText('8.0×')
  await page.getByRole('button', { name: 'Reset zoom' }).click()
  await expect(page.locator('.map-status')).toContainText('1.0×')
})

test('opponent landing automatically shows the actual rent transfer', async ({ page }) => {
  await enter(page)
  await page.getByRole('button', { name: 'Fast resolution off', exact: true }).click()
  let paidRent = false
  for (let turn = 0; turn < 40; turn++) {
    await page.getByRole('button', { name: /Roll the dice/ }).click()
    const card = page.getByRole('dialog')
    await expect(card).toBeVisible()
    if (await card.getByText(/^Paid CR .* rent to/).count()) {
      const rent = await card.locator('.inspector-stats > div').nth(1).locator('strong').textContent()
      await expect(card.getByText(/^Paid CR .* rent to/)).toContainText(`Paid ${rent} rent`)
      paidRent = true
      break
    }
    const acquire = card.getByRole('button', { name: /Acquire/ })
    if (await acquire.count()) {
      if (await acquire.isEnabled()) await acquire.click()
      else { await card.getByRole('button', { name: 'Pass', exact: true }).click(); continue }
    }
    await card.getByRole('button', { name: /End turn/ }).click()
  }
  expect(paidRent).toBe(true)
})

test('a fresh table requires confirmation and can restart with only two players', async ({ page }) => {
  await enter(page)
  const card = await findAvailableDeed(page)
  await card.getByRole('button', { name: 'Pass', exact: true }).click()
  await page.getByRole('button', { name: 'Open local profile' }).click()
  await page.getByRole('button', { name: /Start a fresh table/ }).click()
  const restart = page.getByRole('dialog', { name: 'Start a fresh table?' })
  await expect(restart).toBeVisible()
  await restart.getByRole('button', { name: 'Start new table' }).click()
  const setup = page.getByRole('dialog', { name: 'Set your table' })
  await setup.getByRole('button', { name: 'Remove', exact: true }).last().click()
  await setup.getByRole('button', { name: 'Remove', exact: true }).last().click()
  await expect(setup.getByRole('button', { name: 'Remove', exact: true }).first()).toBeDisabled()
  await setup.getByRole('button', { name: /Enter the city/ }).click()
  await expect(page.getByRole('heading', { name: '2 seats live' })).toBeVisible()
  await expect(page.locator('.match-pill')).toContainText('TURN 0')
  await expect(page.getByRole('button', { name: 'Add a player' })).toBeEnabled()
})

test('mobile setup and landing fit the viewport with keyboard-accessible controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await enter(page)
  await page.getByRole('button', { name: 'Add a player' }).click()
  const setup = page.getByRole('dialog')
  await expect(setup.getByLabel('Player 1 character', { exact: true })).toBeVisible()
  await setup.getByLabel('Player 1 character', { exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(setup.getByRole('button', { name: 'Remove', exact: true }).first()).toBeFocused()
  await setup.getByRole('button', { name: 'Close', exact: true }).click()
  const card = await findAvailableDeed(page)
  await expect(card.getByRole('button', { name: /Acquire/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const bounds = await card.boundingBox()
  expect(bounds!.width).toBeLessThanOrEqual(390)
})

test('visual checkpoints for home, loop, detailed deeds and mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await expect(page.locator('.hero-copy h1')).toHaveCSS('font-family', /Fraunces/)
  await page.screenshot({ path: testInfo.outputPath('home-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: 'Enter the city' }).first().click()
  await expect(page.locator('canvas')).toBeVisible()
  await page.waitForTimeout(600)
  await page.screenshot({ path: testInfo.outputPath('board-loop.png') })
  await page.getByText('Browse all 144 spaces', { exact: true }).click()
  await page.getByRole('searchbox').fill('Glassworks Arcade')
  await page.locator('.map-directory-list button').click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: testInfo.outputPath('board-details.png') })
  await page.getByRole('button', { name: 'Reset zoom' }).click()
  const card = await findAvailableDeed(page)
  await page.screenshot({ path: testInfo.outputPath('landing-deed.png') })
  await card.getByRole('button', { name: 'Pass', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Add a player' }).isDisabled()
  await page.screenshot({ path: testInfo.outputPath('game-mobile.png'), fullPage: true })
})
