import { expect, test } from '@playwright/test'

// Matches the app's todayIso(): the browser and the test run on the same machine and time zone.
function localToday(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

test('complete user journey: register, rate, heatmap, append, search', async ({ page }) => {
  const today = localToday()
  const username = `e2e-${Date.now()}`

  // 1. Register a new user.
  await page.goto('/')
  await page.getByRole('button', { name: 'Need an account? Register' }).click()
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()

  // 2. Save good/bad thoughts one at a time, then rate the day.
  const todayBlock = page.locator(`a[data-band][href="/day/${today}"]`)
  await expect(todayBlock).toHaveAttribute('data-band', 'none')
  await page.getByLabel('Good thing 1').fill('Walked the dog in the sunshine')
  await page.getByRole('button', { name: 'Add entry' }).first().click()
  await expect(page.getByRole('article').filter({ hasText: 'Walked the dog in the sunshine' })).toBeVisible()
  await page.getByLabel('Bad thing').fill('Missed the morning bus')
  await page.getByRole('button', { name: 'Add entry' }).last().click()
  await expect(page.getByRole('article').filter({ hasText: 'Missed the morning bus' })).toBeVisible()
  await page.getByLabel('How was your day?').selectOption('8')
  await page.getByRole('button', { name: 'Save rating' }).click()

  // 3. The rating is saved and today's heatmap block turns green.
  await expect(page.getByLabel('Change rating')).toHaveValue('8')
  await expect(todayBlock).toHaveAttribute('data-band', 'good')

  // 4. Open the day view and append a note to a specific sub-entry.
  await todayBlock.click()
  await expect(page).toHaveURL(`/day/${today}`)
  const goodEntry = page.getByRole('article').filter({ hasText: 'Walked the dog in the sunshine' })
  await goodEntry.getByLabel('Add a note').fill('The dog napped all afternoon')
  await goodEntry.getByRole('button', { name: 'Append' }).click()

  // 5. The note appears under that sub-entry only.
  await expect(goodEntry.getByText('The dog napped all afternoon')).toBeVisible()
  const badEntry = page.getByRole('article').filter({ hasText: 'Missed the morning bus' })
  await expect(badEntry.getByText('The dog napped all afternoon')).toHaveCount(0)

  // 6. Search for the appended text and navigate back to the day view.
  await page.getByRole('searchbox', { name: 'Search journal' }).fill('napped')
  await page.getByRole('searchbox', { name: 'Search journal' }).press('Enter')
  await expect(page).toHaveURL(/\/search\?q=napped/)
  const result = page.getByRole('article').filter({ hasText: 'The dog napped all afternoon' })
  await expect(result).toContainText('Note on a Good entry')
  await result.getByRole('link').click()
  await expect(page).toHaveURL(`/day/${today}`)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(': 8/10')
})
