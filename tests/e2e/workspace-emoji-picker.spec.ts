import type { Page, TestInfo } from '@stablyai/playwright-test'
import { expect, test } from './helpers/alfred-app'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'

async function captureProof(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (process.env.ALFRED_E2E_RECORD_VIDEO === '1') {
    return
  }
  const screenshotPath = testInfo.outputPath(name)
  await page.screenshot({ path: screenshotPath })
  await testInfo.attach(name, { path: screenshotPath, contentType: 'image/png' })
}

test.describe('Workspace emoji picker', () => {
  test.beforeEach(async ({ alfredPage }) => {
    await waitForSessionReady(alfredPage)
    await waitForActiveWorktree(alfredPage)
    await ensureTerminalVisible(alfredPage)
    await alfredPage.waitForTimeout(750)
  })

  test('inserts emoji in sidebar rename, worktree details, and Cmd+J', async ({
    alfredPage
  }, testInfo) => {
    const title = alfredPage.locator('[data-worktree-title-inline-rename=""]').first()
    await expect(title).toBeVisible()
    await title.dblclick()

    const inlineInput = alfredPage.locator('[data-worktree-title-rename-input="true"]')
    await expect(inlineInput).toBeVisible()
    await inlineInput.fill('Sidebar proof')
    await captureProof(alfredPage, testInfo, 'sidebar-rename-before.png')
    await inlineInput.pressSequentially(' :wink', { delay: 60 })
    const inlineSuggestions = alfredPage.locator('[data-workspace-emoji-suggestions="true"]')
    await expect(inlineSuggestions.getByRole('option', { name: ':wink:' })).toBeVisible()
    await captureProof(alfredPage, testInfo, 'sidebar-rename-picker.png')
    await inlineInput.press('Enter')
    await expect(inlineInput).toHaveValue('Sidebar proof 😉 ')
    await inlineInput.press('Enter')
    await expect(alfredPage.getByText('Sidebar proof 😉', { exact: true }).first()).toBeVisible()

    await alfredPage.evaluate(() => {
      const state = window.__store!.getState()
      const worktree = Object.values(state.worktreesByRepo)
        .flat()
        .find((candidate) => candidate.id === state.activeWorktreeId)
      if (!worktree) {
        throw new Error('Active worktree not found')
      }
      state.openModal('edit-meta', {
        worktreeId: worktree.id,
        repoId: worktree.repoId,
        currentDisplayName: worktree.displayName,
        currentComment: worktree.comment,
        focus: 'displayName'
      })
    })

    const detailsDialog = alfredPage.getByRole('dialog', { name: 'Edit Worktree Details' })
    const displayNameInput = detailsDialog.getByPlaceholder('Custom display name...')
    await expect(displayNameInput).toBeFocused()
    await displayNameInput.fill('Details proof')
    await captureProof(alfredPage, testInfo, 'worktree-details-before.png')
    await displayNameInput.pressSequentially(' :wink', { delay: 60 })
    const detailsSuggestions = detailsDialog.locator('[data-workspace-emoji-suggestions="true"]')
    await expect(detailsSuggestions.getByRole('option', { name: ':wink:' })).toBeVisible()
    await captureProof(alfredPage, testInfo, 'worktree-details-picker.png')
    await displayNameInput.press('Enter')
    await expect(displayNameInput).toHaveValue('Details proof 😉 ')
    await detailsDialog.getByRole('button', { name: 'Cancel' }).click()

    await alfredPage.evaluate(() => window.__store!.getState().openModal('worktree-palette'))
    const palette = alfredPage.getByRole('dialog', { name: 'Jump to...' })
    const paletteInput = palette.getByPlaceholder(
      'Search chats, terminals, worktrees, settings, and actions...'
    )
    await expect(paletteInput).toBeFocused()
    await captureProof(alfredPage, testInfo, 'cmd-j-before.png')
    await paletteInput.pressSequentially(':wink', { delay: 60 })
    const paletteSuggestions = palette.locator('[data-workspace-emoji-suggestions="true"]')
    await expect(paletteSuggestions.getByRole('option', { name: ':wink:' })).toBeVisible()
    await captureProof(alfredPage, testInfo, 'cmd-j-picker.png')
    await paletteInput.press('Enter')
    await expect(paletteInput).toHaveValue('😉 ')
    await expect(palette.getByText('Sidebar proof 😉', { exact: true }).first()).toBeVisible()
    await alfredPage.waitForTimeout(750)
  })
})
