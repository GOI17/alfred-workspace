import { test, expect } from './helpers/alfred-app'
import {
  cleanupMarkdownFixture,
  createMarkdownFixture,
  getActiveWorktreeContext,
  openMarkdownFixture,
  waitForRichMarkdownEditor
} from './helpers/markdown-editor-fixture'
import {
  collectRichMarkdownPageErrors,
  expectNoRichMarkdownSchemaCrash,
  INLINE_IMAGE_DETAILS_MARKDOWN,
  INLINE_IMAGE_FIXTURE_DIRECTORY,
  INLINE_IMAGE_PARAGRAPH_MARKDOWN,
  writeInlineImageAsset
} from './helpers/markdown-inline-image'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

// A markdown image nested in a paragraph or a toggle summary used to parse into a
// schema-invalid document that only threw on the first edit reassembling it.
test.describe('Rich markdown inline image regression', () => {
  test.beforeEach(async ({ alfredPage }) => {
    await waitForSessionReady(alfredPage)
    await waitForActiveWorktree(alfredPage)
  })

  test('an inline image inside a paragraph survives a keystroke', async ({
    alfredPage
  }, testInfo) => {
    const context = await getActiveWorktreeContext(alfredPage)
    const pageErrors = collectRichMarkdownPageErrors(alfredPage)
    let filePath: string | null = null

    try {
      writeInlineImageAsset(context.rootPath)
      filePath = await createMarkdownFixture(
        context,
        INLINE_IMAGE_FIXTURE_DIRECTORY,
        'paragraph-inline-image',
        testInfo.workerIndex,
        INLINE_IMAGE_PARAGRAPH_MARKDOWN
      )
      await openMarkdownFixture(alfredPage, context, filePath)
      const editor = await waitForRichMarkdownEditor(alfredPage)

      const paragraph = editor.locator('p').filter({ hasText: 'more text' }).first()
      await expect(paragraph).toBeVisible({ timeout: 15_000 })
      await expect(editor.locator('img')).toHaveCount(1, { timeout: 15_000 })

      // Typing at the paragraph start reassembles the whole paragraph, which is
      // the frame the reported RangeError bottomed out in.
      await paragraph.click({ position: { x: 12, y: 8 } })
      await alfredPage.keyboard.press('Home')
      await alfredPage.keyboard.type('X')

      await expect(editor.locator('p').filter({ hasText: 'XSome text' })).toHaveCount(1)
      await expect(editor.locator('img')).toHaveCount(1)
      await expectNoRichMarkdownSchemaCrash(alfredPage, pageErrors)
    } finally {
      await cleanupMarkdownFixture(filePath)
    }
  })

  test('an inline image inside a toggle summary survives a keystroke', async ({
    alfredPage
  }, testInfo) => {
    const context = await getActiveWorktreeContext(alfredPage)
    const pageErrors = collectRichMarkdownPageErrors(alfredPage)
    let filePath: string | null = null

    try {
      writeInlineImageAsset(context.rootPath)
      filePath = await createMarkdownFixture(
        context,
        INLINE_IMAGE_FIXTURE_DIRECTORY,
        'details-inline-image',
        testInfo.workerIndex,
        INLINE_IMAGE_DETAILS_MARKDOWN
      )
      await openMarkdownFixture(alfredPage, context, filePath)
      const editor = await waitForRichMarkdownEditor(alfredPage)

      const summary = editor.locator('summary').first()
      await expect(summary).toBeVisible({ timeout: 15_000 })
      await expect(editor.locator('summary img')).toHaveCount(1, { timeout: 15_000 })

      await summary.click()
      await alfredPage.keyboard.press('End')
      await alfredPage.keyboard.type('X')

      await expect(editor.locator('summary').filter({ hasText: 'labelX' })).toHaveCount(1)
      await expect(editor.locator('summary img')).toHaveCount(1)
      await expectNoRichMarkdownSchemaCrash(alfredPage, pageErrors)
    } finally {
      await cleanupMarkdownFixture(filePath)
    }
  })

  test('a formatting command over an inline image keeps the image', async ({
    alfredPage
  }, testInfo) => {
    const context = await getActiveWorktreeContext(alfredPage)
    const pageErrors = collectRichMarkdownPageErrors(alfredPage)
    let filePath: string | null = null

    try {
      writeInlineImageAsset(context.rootPath)
      filePath = await createMarkdownFixture(
        context,
        INLINE_IMAGE_FIXTURE_DIRECTORY,
        'paragraph-inline-image-bold',
        testInfo.workerIndex,
        INLINE_IMAGE_PARAGRAPH_MARKDOWN
      )
      await openMarkdownFixture(alfredPage, context, filePath)
      const editor = await waitForRichMarkdownEditor(alfredPage)

      const paragraph = editor.locator('p').filter({ hasText: 'more text' }).first()
      await expect(paragraph).toBeVisible({ timeout: 15_000 })
      await expect(editor.locator('img')).toHaveCount(1, { timeout: 15_000 })

      // toggleBold runs tr.addMark across the selection, which reassembles every
      // paragraph it spans — and silently dropped the image before the fix.
      await paragraph.click({ position: { x: 12, y: 8 } })
      await alfredPage.keyboard.press('ControlOrMeta+a')
      await alfredPage.getByRole('button', { name: 'Bold', exact: true }).first().click()

      await expect(editor.locator('strong').first()).toBeVisible()
      await expect(editor.locator('img')).toHaveCount(1)
      await expectNoRichMarkdownSchemaCrash(alfredPage, pageErrors)
    } finally {
      await cleanupMarkdownFixture(filePath)
    }
  })
})
