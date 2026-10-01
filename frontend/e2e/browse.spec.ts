import { expect, test } from '@playwright/test'
import { ADMIN_USERNAME, localToday, logIn, openMenuItem } from './helpers.ts'

// The admin's journal has today's day rated 8 from the journey spec.
test('browses past days from the day view and the search page', async ({ page }) => {
  const today = localToday()
  await logIn(page, ADMIN_USERNAME)

  // Previous and next day links on the day view; today has no next day.
  await page.goto(`/day/${today}`)
  await expect(page.getByRole('link', { name: 'Next day →' })).toHaveCount(0)
  await page.getByRole('link', { name: '← Previous day' }).click()
  await expect(page.getByText('No entry was written for this day.')).toBeVisible()
  await page.getByRole('link', { name: 'Next day →' }).click()
  await expect(page).toHaveURL(`/day/${today}`)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(': 8/10')

  // Jump to a date from the search page.
  await openMenuItem(page, ADMIN_USERNAME, 'Search')
  await page.getByLabel('Date').fill('2020-02-29')
  await page.getByRole('button', { name: 'Go' }).click()
  await expect(page).toHaveURL('/day/2020-02-29')

  // The month calendar and heatmap load only when asked, and both show today's rating.
  await page.getByRole('banner').getByRole('link', { name: 'Search', exact: true }).first().click()
  const todayLinks = page.locator(`main a[href="/day/${today}"]`)
  await expect(todayLinks).toHaveCount(0)

  const calendarSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Month calendar' }) })
  await calendarSection.getByRole('button', { name: 'Show' }).click()
  await expect(calendarSection.locator(`a[href="/day/${today}"]`)).toHaveAccessibleName(/: rating 8, \d+ entries$/)

  const heatmapSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Heatmap' }) })
  await heatmapSection.getByLabel('Range').selectOption('Last 365 days')
  await heatmapSection.getByRole('button', { name: 'Show' }).click()
  await expect(heatmapSection.getByRole('link')).toHaveCount(365)
  await expect(heatmapSection.locator(`a[href="/day/${today}"]`)).toHaveAccessibleName(/: rating 8, \d+ entries$/)
})
