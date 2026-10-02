import { expect, test, type Page } from '@playwright/test'
import { createApprovedUser, logIn, openMenuItem } from './helpers.ts'

function settingSaved(page: Page, setting: string) {
  return page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().endsWith(`/api/settings/${setting}`) && r.ok())
}

test('settings changes are saved to the account', async ({ page, browser, request }) => {
  // Its own user, since the time zone set here decides "today" for other specs' entries.
  const username = `e2e-settings-${Date.now()}`
  await createApprovedUser(request, username)
  await logIn(page, username)
  await openMenuItem(page, username, 'Settings')
  const root = page.locator('html')

  // Theme changes apply straight away.
  let saved = settingSaved(page, 'BrightnessTheme')
  await page.getByLabel('Mode').selectOption('dark')
  await saved
  await expect(root).toHaveAttribute('data-theme', 'dark')
  saved = settingSaved(page, 'ColourTheme')
  await page.getByLabel('Color').selectOption('violet')
  await saved
  await expect(root).toHaveAttribute('data-color', 'violet')

  saved = settingSaved(page, 'TimeZone')
  await page.getByLabel('Time zone').selectOption('Asia/Tokyo')
  await saved

  // A fresh browser has no cached theme, so it can only get these from the server.
  const freshContext = await browser.newContext()
  const freshPage = await freshContext.newPage()
  await logIn(freshPage, username)
  await expect(freshPage.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(freshPage.locator('html')).toHaveAttribute('data-color', 'violet')
  await openMenuItem(freshPage, username, 'Settings')
  await expect(freshPage.getByLabel('Mode')).toHaveValue('dark')
  await expect(freshPage.getByLabel('Color')).toHaveValue('violet')
  await expect(freshPage.getByLabel('Time zone')).toHaveValue('Asia/Tokyo')
  await freshContext.close()
})
