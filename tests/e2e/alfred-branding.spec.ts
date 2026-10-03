import { expect, test } from './helpers/alfred-app'

test.use({ seedTestRepo: false })

test('shows Alfred workspace with an isolated background installation', async ({
  alfredPage,
  electronApp
}, testInfo) => {
  await expect(
    alfredPage.getByRole('heading', { name: 'Alfred workspace', exact: true })
  ).toBeVisible()
  await expect(alfredPage.getByRole('img', { name: 'Alfred logo', exact: true })).toBeVisible()
  const identity = await electronApp.evaluate(({ app, BrowserWindow }) => ({
    name: app.getName(),
    visibleWindows: BrowserWindow.getAllWindows().filter((window) => window.isVisible()).length
  }))
  expect(identity.name).toBe('Alfred workspace Dev')
  expect(identity.visibleWindows).toBe(0)
  await alfredPage.screenshot({ path: testInfo.outputPath('alfred-workspace.png') })
})
