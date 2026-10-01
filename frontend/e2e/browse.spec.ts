import { expect, test } from '@playwright/test'
import { ADMIN_USERNAME, localToday, logIn, openMenuItem } from './helpers.ts'

// The admin's journal has today's day rated 8 from the journey spec.
test('browses past days from the day view and the history page', async ({ page }) => {
  const today = localToday()
  await logIn(page, ADMIN_USERNAME)

  // Previous and next day links on the day view; today has no next day.
  await page.goto(`/day/${today}`)
  await expect(page.getByRole('link', { name: 'Next day →' })).toHaveCount(0)
  await page.getByRole('link', { name: '← Previous day' }).click()
  await expect(page.getByText('No entries were written.')).toBeVisible()
  await page.getByRole('link', { name: 'Next day →' }).click()
  await expect(page).toHaveURL(`/day/${today}`)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(': 8/10')

  // The history page has no search bar and opens on this month's calendar, which shows today's rating.
  await openMenuItem(page, ADMIN_USERNAME, 'History')
  await expect(page.getByRole('searchbox')).toHaveCount(0)
  const calendar = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Month calendar' }) })
  await expect(calendar.locator(`a[href="/day/${today}"]`)).toHaveAccessibleName(/: rating 8, \d+ entries$/)

  // The heatmap loads only when asked.
  const heatmap = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Heatmap' }) })
  await expect(heatmap.getByRole('link')).toHaveCount(0)
  await heatmap.getByLabel('Range').selectOption('Last 365 days')
  await heatmap.getByRole('button', { name: 'Show' }).click()
  await expect(heatmap.getByRole('link')).toHaveCount(365)
  await expect(heatmap.locator(`a[href="/day/${today}"]`)).toHaveAccessibleName(/: rating 8, \d+ entries$/)

  // Jump to a date starts on today.
  await expect(page.getByLabel('Date')).toHaveValue(today)
  await page.getByLabel('Date').fill('2020-02-29')
  await page.getByRole('button', { name: 'Go' }).click()
  await expect(page).toHaveURL('/day/2020-02-29')
})
