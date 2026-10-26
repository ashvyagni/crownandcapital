import { expect, test } from '@playwright/test'

test('a copied invite link prefills the join flow in a fresh browser and completes a join', async ({ browser }, testInfo) => {
  test.setTimeout(120_000)
  const hostContext = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
  const guestContext = await browser.newContext()
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()
  try {
    await host.goto('/')
    await host.getByRole('button', { name: 'Online table', exact: true }).click()
    await host.getByRole('textbox', { name: 'Your online name' }).fill('Link Alice')
    await host.getByRole('button', { name: 'Create online room' }).click()
    const code = host.getByRole('status', { name: 'Room code', exact: true })
    await expect(code).toBeVisible()
    const roomCode = (await code.textContent())!.trim()
    await test.step('host copies the invite link', async () => {
      await host.getByRole('button', { name: 'Copy invite link' }).click()
      await expect(host.getByRole('status', { name: 'Invite link status' })).toHaveText('Invite link copied to your clipboard.')
      const invite = await host.evaluate(() => navigator.clipboard.readText())
      expect(invite).toBe(`${new URL(host.url()).origin}/r/${roomCode}`)
      await expect(host.getByRole('status', { name: 'Room code', exact: true })).toHaveText(roomCode)
    })
    await test.step('guest opens the link and joins without typing a room code', async () => {
      const invite = await host.evaluate(() => navigator.clipboard.readText())
      await guest.goto(invite)
      const lobby = guest.getByRole('dialog', { name: 'The online table' })
      await expect(lobby).toBeVisible()
      await expect(lobby.getByRole('textbox', { name: 'Room code', exact: true })).toHaveValue(roomCode)
      await lobby.getByRole('textbox', { name: 'Your online name' }).fill('Link Bob')
      await lobby.getByRole('button', { name: 'Join online room' }).click()
      await expect(host.locator('.online-seats')).toContainText('Link Bob')
      await expect(guest.locator('.online-seats')).toContainText('Link Alice')
      await expect(guest.locator('.online-seats')).toContainText('Link Bob')
    })
  } catch (cause) {
    await guest.screenshot({ path: testInfo.outputPath('guest-failure.png') }).catch(() => {})
    await host.screenshot({ path: testInfo.outputPath('host-failure.png') }).catch(() => {})
    throw cause
  } finally {
    await hostContext.close().catch(() => {})
    await guestContext.close().catch(() => {})
  }
})

test('an unknown room link shows a friendly error and recovers to the landing page', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/r/BOGUSCODE')
  const card = page.getByRole('dialog', { name: 'That room link did not work' })
  await expect(card).toBeVisible()
  await expect(card).toContainText('/r/BOGUSCODE')
  await expect(card).toContainText('10-character room code')
  await card.getByRole('button', { name: 'Go to the home page' }).click()
  await expect(card).not.toBeVisible()
  await expect(page.locator('.hero-copy h1')).toContainText('CROWN')
  await expect(page).toHaveURL(/\/$/)
  await page.getByRole('button', { name: 'Enter the city' }).first().click()
  await expect(page.getByRole('heading', { name: 'THE CITY, in play.' })).toBeVisible()
  expect(errors).toEqual([])
})
