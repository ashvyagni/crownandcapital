import { expect, test, type Browser, type Page } from '@playwright/test'

type RoomHandles = { hostContext: Awaited<ReturnType<Browser['newContext']>>; guestContext: Awaited<ReturnType<Browser['newContext']>>; host: Page; guest: Page; roomCode: string; close: () => Promise<void> }

async function twoClientRoom(browser: Browser): Promise<RoomHandles> {
  const hostContext = await browser.newContext()
  const guestContext = await browser.newContext()
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()
  const close = async () => { await hostContext.close().catch(() => {}); await guestContext.close().catch(() => {}) }
  await host.goto('/')
  await guest.goto('/')
  await host.getByRole('button', { name: 'Online table', exact: true }).click()
  await host.getByRole('textbox', { name: 'Your online name' }).fill('Resume Alice')
  await host.getByRole('button', { name: 'Create online room' }).click()
  const code = host.getByRole('status', { name: 'Room code', exact: true })
  await expect(code).toBeVisible()
  const roomCode = (await code.textContent())!.trim()
  await guest.getByRole('button', { name: 'Online table', exact: true }).click()
  await guest.getByRole('textbox', { name: 'Your online name' }).fill('Resume Bob')
  await guest.getByRole('textbox', { name: 'Room code', exact: true }).fill(roomCode)
  await guest.getByRole('button', { name: 'Join online room' }).click()
  await expect(host.locator('.online-seats')).toContainText('Resume Bob')
  return { hostContext, guestContext, host, guest, roomCode, close }
}

async function resolveLanding(page: Page) {
  const card = page.getByRole('dialog')
  await expect(card).toBeVisible()
  const pass = card.getByRole('button', { name: 'Pass', exact: true })
  if (await pass.count()) await pass.click()
  else await card.getByRole('button', { name: /End turn/ }).click()
}

// Starts the table and hands the desk to the guest, who rolls into a pending landing.
async function startAndReachGuestTurn(host: Page, guest: Page) {
  await host.getByRole('button', { name: 'Start online game' }).click()
  await expect(host.getByRole('button', { name: /Roll the dice/ })).toBeEnabled()
  await host.getByRole('button', { name: /Roll the dice/ }).click()
  await resolveLanding(host)
  await expect(guest.getByRole('button', { name: /Roll the dice/ })).toBeEnabled()
}

test('a dropped socket shows waiting and reconnecting states on both clients, then resumes the same turn', async ({ browser }, testInfo) => {
  test.setTimeout(120_000)
  const { host, guest, close } = await twoClientRoom(browser)
  try {
    await startAndReachGuestTurn(host, guest)
    await guest.getByRole('button', { name: /Roll the dice/ }).click()
    const landing = guest.getByRole('dialog')
    await expect(landing).toBeVisible()
    const heading = (await landing.getByRole('heading').textContent())!
    const turn = (await guest.locator('.match-pill').textContent())!

    // Abrupt socket kill: every room socket this tab opens is closed on arrival while the page reloads.
    let blocked = true
    await guest.routeWebSocket(/\/ws$/, socket => { if (blocked) socket.close(); else socket.connectToServer() })
    await guest.reload()

    await test.step('both clients show the disconnected state', async () => {
      await expect(guest.locator('.connection-state')).toContainText('Reconnecting…', { timeout: 20_000 })
      await expect(host.locator('.connection-banner')).toContainText('Waiting for Resume Bob · seat reserved', { timeout: 20_000 })
      await expect(host.locator('.turn-action')).toContainText('Waiting for Resume Bob — seat reserved while they reconnect.')
      await expect(host.locator('.roster')).toContainText('At the desk · offline')
    })

    blocked = false
    await test.step('the seat reclaims and the waiting indicators clear', async () => {
      // The resume budget is six attempts (~31.5s). If the socket block outlasts it,
      // the seat settles at Offline; the manual Reconnect button resumes the same reclaim.
      const state = guest.locator('.connection-state')
      await expect.poll(async () => {
        const label = (await state.textContent()) ?? ''
        if (label.startsWith('Connected')) return 'connected'
        if (label.includes('Offline')) return 'offline'
        return 'reconnecting'
      }, { timeout: 45_000, intervals: [500, 1_000, 5_000] }).toMatch(/^(connected|offline)$/)
      if (!(await state.textContent())!.startsWith('Connected')) {
        await expect(state).toContainText('Offline')
        await guest.locator('.connection-banner').getByRole('button', { name: 'Reconnect' }).click()
      }
      await expect(state).toContainText('Connected', { timeout: 20_000 })
      await expect(guest.getByRole('dialog').getByRole('heading')).toHaveText(heading)
      await expect(guest.locator('.match-pill')).toHaveText(turn)
      await expect(host.locator('.connection-banner')).not.toContainText('Waiting for')
      await expect(host.locator('.roster')).not.toContainText('offline')
      await expect(host.locator('.turn-action')).not.toContainText('Waiting for')
    })

    // The reclaimed seat keeps its turn: the guest resolves the landing and the desk returns to the host.
    await resolveLanding(guest)
    await expect(host.getByRole('button', { name: /Roll the dice/ })).toBeEnabled()
    await expect(guest.getByRole('button', { name: /Roll the dice/ })).toBeDisabled()
    await guest.screenshot({ path: testInfo.outputPath('reconnected-table.png') })
  } catch (cause) {
    await guest.screenshot({ path: testInfo.outputPath('reconnect-failure.png') }).catch(() => {})
    await host.screenshot({ path: testInfo.outputPath('reconnect-host-failure.png') }).catch(() => {})
    throw cause
  } finally { await close() }
})

test('an abrupt reload mid-turn reclaims the same seat and restores the same turn', async ({ browser }, testInfo) => {
  test.setTimeout(120_000)
  const { host, guest, close } = await twoClientRoom(browser)
  try {
    await startAndReachGuestTurn(host, guest)
    await guest.getByRole('button', { name: /Roll the dice/ }).click()
    const landing = guest.getByRole('dialog')
    await expect(landing).toBeVisible()
    const heading = (await landing.getByRole('heading').textContent())!
    const turn = (await guest.locator('.match-pill').textContent())!

    await guest.reload()

    await expect(guest.locator('.connection-state')).toContainText('Connected', { timeout: 20_000 })
    await expect(guest.getByRole('dialog').getByRole('heading')).toHaveText(heading)
    await expect(guest.locator('.match-pill')).toHaveText(turn)
    await expect(guest.locator('.roster')).toContainText('Resume Bob · you')
    await expect(host.locator('.connection-banner')).not.toContainText('Waiting for')
    await expect(host.locator('.roster')).not.toContainText('offline')

    // Same turn, same authority: the guest finishes the landing and play returns to the host.
    await resolveLanding(guest)
    await expect(host.getByRole('button', { name: /Roll the dice/ })).toBeEnabled()
    await expect(guest.getByRole('button', { name: /Roll the dice/ })).toBeDisabled()
    await guest.screenshot({ path: testInfo.outputPath('reloaded-table.png') })
  } catch (cause) {
    await guest.screenshot({ path: testInfo.outputPath('reload-failure.png') }).catch(() => {})
    await host.screenshot({ path: testInfo.outputPath('reload-host-failure.png') }).catch(() => {})
    throw cause
  } finally { await close() }
})

test('a departed creator keeps a reserved seat, an explicit waiting state and a joinable room', async ({ browser }, testInfo) => {
  test.setTimeout(120_000)
  const { hostContext, guestContext, guest, roomCode, close } = await twoClientRoom(browser)
  try {
    await expect(guest.locator('.online-seats')).toContainText('Connected · Host')
    await hostContext.close()

    await expect(guest.locator('.online-seats')).toContainText('Disconnected · seat reserved', { timeout: 20_000 })
    await expect(guest.locator('.online-seats')).toContainText('Disconnected · seat reserved · Host')
    await expect(guest.getByRole('dialog', { name: 'The online table' })).toContainText('Waiting for Resume Alice')
    // Positive guest-side assertion: the departed creator is the only seat that can start,
    // so the guest lobby shows the host-dependency in its own waiting indicator instead.
    await expect(guest.getByRole('dialog', { name: 'The online table' }).locator('p[role="status"]')).toContainText(`Waiting for Resume Alice — they are disconnected, their seat is reserved, and only they can start this table.`)

    const third = await browser.newContext()
    const cara = await third.newPage()
    try {
      await cara.goto('/')
      await cara.getByRole('button', { name: 'Online table', exact: true }).click()
      await cara.getByRole('textbox', { name: 'Your online name' }).fill('Resume Cara')
      await cara.getByRole('textbox', { name: 'Room code', exact: true }).fill(roomCode)
      await cara.getByRole('button', { name: 'Join online room' }).click()
      await expect(guest.locator('.online-seats')).toContainText('Resume Cara')
      await expect(guest.locator('.online-seats')).toContainText('Resume Bob')
    } finally { await third.close().catch(() => {}) }
    await guest.screenshot({ path: testInfo.outputPath('creator-departed.png') })
  } catch (cause) {
    await guest.screenshot({ path: testInfo.outputPath('creator-departed-failure.png') }).catch(() => {})
    throw cause
  } finally { await guestContext.close().catch(() => {}); await close() }
})
