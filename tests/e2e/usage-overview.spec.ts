import { test, expect } from './helpers/alfred-app'
import { getStoreState, waitForSessionReady } from './helpers/store'

test.describe('usage overview', () => {
  test.beforeEach(async ({ alfredPage }) => {
    await waitForSessionReady(alfredPage)
  })

  test('Stats & Usage opens on the combined overview with provider controls', async ({
    alfredPage
  }) => {
    await alfredPage.evaluate(() => {
      const state = window.__store!.getState()
      state.openSettingsPage()
    })

    await expect
      .poll(async () => getStoreState<string>(alfredPage, 'activeView'), { timeout: 5_000 })
      .toBe('settings')
    await alfredPage.getByRole('button', { name: 'Stats & Usage' }).click()
    await expect(alfredPage.getByRole('heading', { name: 'Usage Analytics' })).toBeVisible()
    const providerDropdown = alfredPage.getByTestId('usage-provider-select')
    await expect(providerDropdown).toHaveAttribute(
      'aria-label',
      'Usage analytics provider: Overview'
    )
    await expect(alfredPage.getByTestId('usage-overview-pane')).toBeVisible()
    await expect(alfredPage.getByRole('heading', { name: 'Usage Overview' })).toBeVisible()
    await expect(alfredPage.getByRole('heading', { name: 'Providers' })).toBeVisible()
    await expect(alfredPage.getByRole('button', { name: 'Enable Claude' })).toBeVisible()
    await expect(alfredPage.getByRole('button', { name: 'Enable Codex' })).toBeVisible()
    await expect(alfredPage.getByRole('button', { name: 'Enable OpenCode' })).toBeVisible()

    await providerDropdown.click()
    await alfredPage.getByRole('menuitem', { name: 'Codex', exact: true }).click()
    await expect(alfredPage.getByRole('heading', { name: 'Codex Usage Tracking' })).toBeVisible()
    await expect(providerDropdown).toHaveAttribute('aria-label', 'Usage analytics provider: Codex')

    await providerDropdown.click()
    await alfredPage.getByRole('menuitem', { name: 'OpenCode', exact: true }).click()
    await expect(alfredPage.getByRole('heading', { name: 'OpenCode Usage Tracking' })).toBeVisible()
    await expect(providerDropdown).toHaveAttribute(
      'aria-label',
      'Usage analytics provider: OpenCode'
    )
  })
})
