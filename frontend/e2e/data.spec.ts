import { expect, test } from '@playwright/test'
import { ADMIN_USERNAME, PASSWORD, localToday, logIn, logOut, openMenuItem } from './helpers.ts'

test("a JSON export imported into another account shows up on that account's heatmap", async ({ page, request }) => {
  const today = localToday()
  const username = `e2e-import-${Date.now()}`

  // A second, approved user to import into.
  const register = await request.post('/api/auth/register', { data: { username, password: PASSWORD } })
  const { id } = (await register.json()) as { id: number }
  const adminLogin = await request.post('/api/auth/login', { data: { username: ADMIN_USERNAME, password: PASSWORD } })
  const { token } = (await adminLogin.json()) as { token: string }
  const approve = await request.post(`/api/admin/users/${id}/approve`, { headers: { Authorization: `Bearer ${token}` } })
  expect(approve.ok()).toBe(true)

  // The admin's journal has today's rated day from the journey spec.
  await logIn(page, ADMIN_USERNAME)
  await openMenuItem(page, ADMIN_USERNAME, 'Settings')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export as JSON' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe(`autograt-${ADMIN_USERNAME}-${today}.json`)
  const exportPath = await download.path()
  await logOut(page, ADMIN_USERNAME)

  await logIn(page, username)
  const todayBlock = page.locator(`a[href="/day/${today}"]`)
  await expect(todayBlock).toHaveAccessibleName(/: no entry$/)
  await openMenuItem(page, username, 'Settings')
  await page.getByLabel('Journal import (JSON)').setInputFiles(exportPath)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('overwrite your entries and ratings')
  await page.getByRole('button', { name: 'Replace and import' }).click()
  await expect(page.getByRole('status')).toContainText('1 day imported (0 replaced)')

  await page.goto('/')
  await expect(todayBlock).toHaveAccessibleName(/: rating 8, \d+ entries$/)
})
