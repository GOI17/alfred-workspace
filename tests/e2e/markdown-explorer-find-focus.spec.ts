import { expect, test } from './helpers/alfred-app'
import { openFileExplorer } from './helpers/file-explorer'
import { pressShortcut } from './helpers/shortcuts'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

test('Explorer-opened Markdown accepts the find shortcut without a document click', async ({
  alfredPage
}) => {
  await waitForSessionReady(alfredPage)
  await waitForActiveWorktree(alfredPage)
  await openFileExplorer(alfredPage)

  const readmeRow = alfredPage.locator('[data-file-explorer-row]').filter({ hasText: 'README.md' })
  await expect(readmeRow).toBeVisible({ timeout: 10_000 })
  await readmeRow.focus()
  await readmeRow.click()

  await expect(alfredPage.locator('.rich-markdown-editor')).toBeVisible({ timeout: 25_000 })
  await pressShortcut(alfredPage, 'f')

  await expect(
    alfredPage.getByRole('textbox', { name: 'Find in rich markdown editor' })
  ).toBeVisible()
})
