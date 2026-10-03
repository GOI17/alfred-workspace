import { expect, test } from './helpers/alfred-app'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { crashGuestRenderer } from './browser-guest-runtime-oracle'
import { observeBrowserLoadingSurface } from './browser-loading-surface-oracle'

test('browser host follows the theme before content and preserves the webpage canvas', async ({
  alfredPage,
  electronApp
}, testInfo) => {
  await waitForSessionReady(alfredPage)
  await ensureTerminalVisible(alfredPage)
  await waitForActiveWorktree(alfredPage)
  const observations = await observeBrowserLoadingSurface(
    alfredPage,
    (name) => testInfo.outputPath(name),
    async (id) => {
      await crashGuestRenderer(electronApp, id)
    }
  )
  expect(observations.filter((entry) => !entry.pass)).toEqual([])
})
