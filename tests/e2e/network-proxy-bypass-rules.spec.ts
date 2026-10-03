import { test, expect } from './helpers/alfred-app'
import { waitForSessionReady } from './helpers/store'

test.describe('network proxy bypass rules', () => {
  test('preserves newline-separated hosts and canonicalizes them on blur', async ({
    alfredPage
  }) => {
    await waitForSessionReady(alfredPage)

    const original = await alfredPage.evaluate(() => window.api.settings.get())
    try {
      await alfredPage.evaluate(() => {
        const state = window.__store?.getState()
        state?.openSettingsTarget({ pane: 'advanced', repoId: null })
        state?.openSettingsPage()
      })

      await expect(alfredPage.getByRole('heading', { name: 'Advanced', exact: true })).toBeVisible()
      await alfredPage.getByRole('button', { name: 'Configure proxy' }).click()
      const bypassRules = alfredPage.locator('#settings-http-proxy-bypass-rules')
      await expect(bypassRules).toBeVisible()
      await expect(bypassRules).toHaveJSProperty('tagName', 'TEXTAREA')

      await bypassRules.fill('localhost\n127.0.0.1\n*.internal.corp')
      await expect(bypassRules).toHaveValue('localhost\n127.0.0.1\n*.internal.corp')
      await alfredPage.locator('#settings-http-proxy-url').focus()

      await expect
        .poll(
          async () =>
            (await alfredPage.evaluate(() => window.api.settings.get())).httpProxyBypassRules
        )
        .toBe('localhost;127.0.0.1;*.internal.corp')
      await expect(bypassRules).toHaveValue('localhost;127.0.0.1;*.internal.corp')
    } finally {
      await alfredPage.evaluate(
        (settings) =>
          window.api.settings.set({ httpProxyBypassRules: settings.httpProxyBypassRules ?? '' }),
        original
      )
    }
  })
})
