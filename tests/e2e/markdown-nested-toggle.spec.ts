import { readFileSync } from 'node:fs'
import { test, expect } from './helpers/alfred-app'
import {
  cleanupMarkdownFixture,
  closeActiveEditorTab,
  createMarkdownFixture,
  getActiveWorktreeContext,
  openMarkdownFixture,
  waitForRichMarkdownEditor
} from './helpers/markdown-editor-fixture'
import {
  expectEditableNestedToggles,
  expectFileKeepsNesting,
  expectPassthroughFallback,
  expectSentinelInsideNestedToggle,
  NESTED_TOGGLE_FIXTURE_DIRECTORY,
  NESTED_TOGGLE_MARKDOWN,
  placeCaretInNestedToggleBody,
  UNSUPPORTED_NESTED_TOGGLE_MARKDOWN
} from './helpers/markdown-nested-toggle'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

test.describe('Markdown nested toggle regression', () => {
  test.beforeEach(async ({ alfredPage }) => {
    await waitForSessionReady(alfredPage)
    await waitForActiveWorktree(alfredPage)
  })

  test('a nested toggle on disk reopens as editable toggles', async ({ alfredPage }, testInfo) => {
    const context = await getActiveWorktreeContext(alfredPage)
    let filePath: string | null = null

    try {
      filePath = await createMarkdownFixture(
        context,
        NESTED_TOGGLE_FIXTURE_DIRECTORY,
        'nested-toggle-reopen',
        testInfo.workerIndex,
        NESTED_TOGGLE_MARKDOWN
      )
      await openMarkdownFixture(alfredPage, context, filePath)
      await waitForRichMarkdownEditor(alfredPage)

      await expectEditableNestedToggles(alfredPage)
    } finally {
      await cleanupMarkdownFixture(filePath)
    }
  })

  test('editing a nested toggle survives save and reopen', async ({ alfredPage }, testInfo) => {
    const context = await getActiveWorktreeContext(alfredPage)
    const sentinel = `editedInsideNestedToggle${Date.now()}`
    let filePath: string | null = null

    try {
      filePath = await createMarkdownFixture(
        context,
        NESTED_TOGGLE_FIXTURE_DIRECTORY,
        'nested-toggle-edit',
        testInfo.workerIndex,
        NESTED_TOGGLE_MARKDOWN
      )
      await openMarkdownFixture(alfredPage, context, filePath)
      await waitForRichMarkdownEditor(alfredPage)
      await expectEditableNestedToggles(alfredPage)

      await placeCaretInNestedToggleBody(alfredPage)
      await alfredPage.keyboard.type(` ${sentinel}`)
      await expectSentinelInsideNestedToggle(alfredPage, sentinel)

      // Save through the real shortcut and assert the bytes that landed on disk.
      await alfredPage.keyboard.press('ControlOrMeta+S')
      const savedPath = filePath
      await expect
        .poll(() => readFileSync(savedPath, 'utf8'), { timeout: 10_000 })
        .toContain(sentinel)
      expectFileKeepsNesting(readFileSync(savedPath, 'utf8'), sentinel)

      // The reported bug only appeared on reopen, so close the tab and parse
      // the saved file again from scratch.
      await closeActiveEditorTab(alfredPage, savedPath)
      await openMarkdownFixture(alfredPage, context, savedPath)
      await waitForRichMarkdownEditor(alfredPage)
      await expectEditableNestedToggles(alfredPage)
      await expectSentinelInsideNestedToggle(alfredPage, sentinel)
    } finally {
      await cleanupMarkdownFixture(filePath)
    }
  })

  test('a nested toggle that cannot be represented stays raw passthrough', async ({
    alfredPage
  }, testInfo) => {
    const context = await getActiveWorktreeContext(alfredPage)
    let filePath: string | null = null

    try {
      filePath = await createMarkdownFixture(
        context,
        NESTED_TOGGLE_FIXTURE_DIRECTORY,
        'nested-toggle-unsupported',
        testInfo.workerIndex,
        UNSUPPORTED_NESTED_TOGGLE_MARKDOWN
      )
      await openMarkdownFixture(alfredPage, context, filePath)
      await waitForRichMarkdownEditor(alfredPage)

      await expectPassthroughFallback(alfredPage)
    } finally {
      await cleanupMarkdownFixture(filePath)
    }
  })
})
