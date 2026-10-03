/**
 * End-to-end coverage for the Automations runs surface.
 *
 * The test intentionally does not depend on seeded run history: a fresh E2E
 * profile may have no automations, but the Runs navigation and empty state must
 * still be usable.
 */

import { test, expect } from './helpers/alfred-app'
import { waitForSessionReady } from './helpers/store'

test('opens the runs dashboard and returns to automations', async ({ alfredPage }) => {
  await waitForSessionReady(alfredPage)

  await alfredPage.evaluate(() => {
    const store = window.__store
    if (!store) {
      throw new Error('window.__store is not available')
    }
    store.getState().openAutomationsPage()
  })

  const runsButton = alfredPage.getByRole('button', { name: 'Runs' })
  await expect(runsButton).toBeVisible()
  await runsButton.click()

  await expect(alfredPage.getByRole('navigation', { name: 'Automations breadcrumb' })).toBeVisible()
  await expect(alfredPage.getByText('Successful · 24h')).toBeVisible()
  await expect(alfredPage.getByText('Failed · 24h')).toBeVisible()
  await expect(alfredPage.getByText('Successful · 7d')).toBeVisible()
  await expect(alfredPage.getByText('Failed · 7d')).toBeVisible()
  await expect(alfredPage.getByRole('button', { name: 'Filters' })).toBeVisible()
  await expect(alfredPage.getByRole('button', { name: 'Refresh runs' })).toBeVisible()
  await expect(alfredPage.getByText('Automation', { exact: true })).toBeVisible()
  await expect(alfredPage.getByText('Triggered', { exact: true })).toBeVisible()
  await expect(alfredPage.getByText('Status', { exact: true })).toBeVisible()

  await alfredPage
    .getByRole('navigation', { name: 'Automations breadcrumb' })
    .getByRole('button', { name: 'Automations' })
    .click()
  await expect(alfredPage.getByRole('heading', { name: 'Automations' })).toBeVisible()
  await expect(runsButton).toBeVisible()
})
