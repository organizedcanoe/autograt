import { expect, test } from '@playwright/test'
import { ADMIN_USERNAME, localToday, openMenuItem, PASSWORD } from './helpers.ts'

test('complete user journey: register, rate, heatmap, append, search', async ({ page }) => {
  const today = localToday()
  const username = ADMIN_USERNAME

  // 1. Register a new user.
  await page.goto('/')
  await page.getByRole('button', { name: 'Need an account? Register' }).click()
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Confirm password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('banner').getByText(username)).toBeVisible()

  // 2. Save the good and bad nudge boxes one at a time, then rate the day.
  const todayBlock = page.locator(`a[href="/day/${today}"]`)
  await expect(todayBlock).toHaveAccessibleName(/: no entry$/)
  await page.getByLabel('Good thing 1').fill('Walked the dog in the sunshine')
  await page.getByRole('button', { name: 'Save', exact: true }).first().click()
  await expect(page.getByRole('article').filter({ hasText: 'Walked the dog in the sunshine' })).toBeVisible()
  await page.getByLabel('Bad thing').fill('Missed the morning bus')
  await page.getByRole('button', { name: 'Save', exact: true }).last().click()
  await expect(page.getByRole('article').filter({ hasText: 'Missed the morning bus' })).toBeVisible()
  await page.getByLabel('How was your day?').selectOption('8')

  // 3. The rating is saved and today's heatmap block reflects it.
  await expect(page.getByLabel('Change rating')).toHaveValue('8')
  await expect(todayBlock).toHaveAccessibleName(/: rating 8, 2 entries$/)

  // 4. Open the day view and append a note to a specific sub-entry.
  await todayBlock.click()
  await expect(page).toHaveURL(`/day/${today}`)
  // The home page shows the same entries, so wait for the day view to replace it before typing.
  await expect(page.getByRole('link', { name: '← Previous day' })).toBeVisible()
  const goodEntry = page.getByRole('article').filter({ hasText: 'Walked the dog in the sunshine' })
  await goodEntry.getByLabel('Add a note').fill('The dog napped all afternoon')
  await goodEntry.getByRole('button', { name: 'Append' }).click()

  // 5. The note appears under that sub-entry only.
  await expect(goodEntry.getByText('The dog napped all afternoon')).toBeVisible()
  const badEntry = page.getByRole('article').filter({ hasText: 'Missed the morning bus' })
  await expect(badEntry.getByText('The dog napped all afternoon')).toHaveCount(0)

  // 6. Open the search page from the menu, search for the appended text and navigate back to the day view.
  await openMenuItem(page, username, 'Search')
  await page.getByRole('searchbox', { name: 'Search journal' }).fill('napped')
  await page.getByRole('searchbox', { name: 'Search journal' }).press('Enter')
  await expect(page).toHaveURL(/\/search\?q=napped/)
  const result = page.getByRole('article').filter({ hasText: 'The dog napped all afternoon' })
  await expect(result).toContainText('Note on a Good entry')
  await result.getByRole('link').click()
  await expect(page).toHaveURL(`/day/${today}`)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(': 8/10')
})
