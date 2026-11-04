import { expect, test, type Page } from '@playwright/test'

// Practice games run 3 automated seats locally, 700ms apart, so all waits ride
// state markers (board turn number in the pill, desk heading) via expect.poll
// instead of sleeps. A bot landing auction keeps the human seat in the loop
// until they fold, so the poll folds for the human when an auction asks for them.

const HUMAN = 'Avery Vale'
const botLabels = (page: Page) => page.locator('.roster .player-row strong').filter({ hasText: '(AI)' })

async function startPractice(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Set a table' }).click()
  const setup = page.getByRole('dialog', { name: 'Set your table' })
  await setup.getByRole('button', { name: 'Practice vs 3 traders' }).click()
  await expect(page.getByRole('heading', { name: '4 seats live' })).toBeVisible()
}

/** Fold as the human whoever an automated seat drags the table into a public auction. */
async function foldAsHumanWhenAsked(page: Page) {
  try {
    const dialog = page.getByRole('dialog')
    if (await dialog.getByLabel('Live auction').count()) {
      await dialog.getByLabel('Bidding as').selectOption({ label: HUMAN })
      const fold = dialog.getByRole('button', { name: 'Fold' })
      if (await fold.isEnabled()) { await fold.click(); return 'folding' }
    }
  } catch { /* the auction resolved between the checks; catch the next interval */ }
  return null
}

/** Runs the table (human folds whenever asked) until the pill reports at least `min` board turns. */
async function awaitMinTurn(page: Page, min: number) {
  await expect.poll(async () => {
    if (await foldAsHumanWhenAsked(page)) return NaN
    return turnNumber(page)
  }, { timeout: 60_000, intervals: [600] }).toBeGreaterThanOrEqual(min)
}

function turnNumber(page: Page) {
  return turnNumberFrom(page.locator('.match-pill'))
}

async function turnNumberFrom(marker: import('@playwright/test').Locator) {
  const match = /TURN (\d+)/.exec((await marker.textContent()) ?? '')
  return match ? Number(match[1]) : 0
}
async function humanFirstTurn(page: Page) {
  await page.getByRole('button', { name: /Roll the dice/ }).click()
  const card = page.getByRole('dialog')
  await expect(card).toBeVisible()
  const end = card.getByRole('button', { name: /End turn/ })
  if (await end.count()) await end.click()
  else await card.getByRole('button', { name: 'Pass', exact: true }).click()
  await expect(card).not.toBeVisible()
}

test('starting practice seeds a labeled table where a bot completes a full turn solo', async ({ page }) => {
  test.slow()
  await startPractice(page)
  await expect(botLabels(page)).toHaveCount(3)
  await expect(page.locator('.roster .player-row').first()).toContainText(HUMAN)
  await expect(page.locator('.roster .player-row').first()).not.toContainText('(AI)')
  await expect(page.locator('.command-panel h2')).toHaveText(HUMAN)
  // Human turn one; the desk then moves to automated seats that each roll,
  // resolve their landing and finish with nobody else present.
  await humanFirstTurn(page)
  await awaitMinTurn(page, 4)
  const desk = page.locator('.command-panel h2')
  await expect(desk).toContainText('(AI)')
  await expect(botLabels(page)).toHaveCount(3)
})

test('practice interleave: after the human ends their turn the next desk is a bot acting unprompted', async ({ page }) => {
  test.slow()
  await startPractice(page)
  await humanFirstTurn(page)
  // No clicks after the human's finish: the desk must move to an automated seat
  // and that seat must roll without any further interaction.
  const desk = page.locator('.command-panel h2')
  await expect.poll(() => desk.textContent(), { timeout: 20_000, intervals: [300] }).toMatch(/\(AI\)/)
  await expect(page.getByRole('button', { name: /Roll the dice/ })).toBeDisabled()
  await awaitMinTurn(page, 2)
  await expect(page.getByRole('button', { name: /Roll the dice/ })).toBeDisabled()
  await expect(desk).toContainText('(AI)')
})

test('practice bots re-derive from the saved seat config after a reload', async ({ page }) => {
  test.slow()
  await startPractice(page)
  await humanFirstTurn(page)
  await awaitMinTurn(page, 2)
  const before = await turnNumber(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: '4 seats live' })).toBeVisible()
  await expect(botLabels(page)).toHaveCount(3)
  await awaitMinTurn(page, before + 1)
})
