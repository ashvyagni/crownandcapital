// Read-only reference study in an isolated browser, never an authenticated profile.
import { chromium } from '@playwright/test'
const out = '/var/folders/w4/nmbkr0ln39z16yt6btwvf8000000gn/T/omnirush'
const browser = await chromium.launch({ headless: true })
try {
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
    await page.goto('https://messenger.abeto.co/', { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.waitForTimeout(8000)
    console.log(name, await page.locator('body').innerText(), await page.locator('canvas').count())
    await page.screenshot({ path: `${out}/messenger-${name}.png`, timeout: 45000 })
    await page.mouse.wheel(0, 650)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${out}/messenger-${name}-scroll.png`, timeout: 45000 })
    await page.close()
  }
} finally { await browser.close() }
