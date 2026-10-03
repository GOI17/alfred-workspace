import { z } from 'zod'
/**
 * Repro + recovery for the stuck-occlusion freeze (field snapshot,
 * v1.4.124-rc.2.perf, 2026-07-06): macOS occlusion tracking wedges
 * document.visibilityState at 'hidden' after display sleep and never fires
 * another visibilitychange. The hidden-delivery gate then marks the pane the
 * user is looking at as hidden, and main drops its renderer-bound bytes
 * indefinitely (78MB dropped across 2 visible ptys in the field) — a frozen
 * terminal with a perfectly healthy transport.
 *
 * The test emulates the wedge exactly as Chromium produces it: visibilityState
 * pinned to 'hidden' with one final visibilitychange, then silence. Recovery
 * must come from the staleness proof — a real keystroke while the document
 * claims hidden — which unlatches the gate and repaints the missed output from
 * the main-owned snapshot, WITHOUT a reload and WITHOUT any visibilitychange.
 */
import type { Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/alfred-app'
import { waitForSessionReady, waitForActiveWorktree, ensureTerminalVisible } from './helpers/store'
import {
  waitForActiveTerminalManager,
  waitForActivePanePtyId,
  execInTerminal,
  getTerminalContent
} from './helpers/terminal'

type DeliverySnapshot = {
  hiddenDeliveryGatedPtyCount: number
  hiddenDeliveryGatedVisiblePtyCount: number
  hiddenDeliveryDroppedChars: number
}

async function getDeliverySnapshot(page: Page): Promise<DeliverySnapshot> {
  return page.evaluate(async () => {
    const snapshot = await window.api.pty.getRendererDeliveryDebugSnapshot()
    return {
      hiddenDeliveryGatedPtyCount: snapshot.hiddenDeliveryGatedPtyCount,
      hiddenDeliveryGatedVisiblePtyCount: snapshot.hiddenDeliveryGatedVisiblePtyCount,
      hiddenDeliveryDroppedChars: snapshot.hiddenDeliveryDroppedChars
    }
  })
}

test.describe('terminal stuck-occlusion recovery', () => {
  test.afterEach(async ({ alfredPage }) => {
    // Drop the instance shadow so the prototype getter (real state) rules
    // again, and fire one genuine visibilitychange to restore tracker trust.
    await alfredPage.evaluate(() => {
      delete (document as { visibilityState?: string }).visibilityState
      document.dispatchEvent(new Event('visibilitychange'))
    })
  })

  test('a keystroke unlatches the hidden-delivery gate wedged by stale visibilityState', async ({
    alfredPage
  }) => {
    test.setTimeout(120_000)
    await waitForSessionReady(alfredPage)
    await waitForActiveWorktree(alfredPage)
    await ensureTerminalVisible(alfredPage)
    await waitForActiveTerminalManager(alfredPage)
    const ptyId = await waitForActivePanePtyId(alfredPage)

    // Live baseline: foreground delivery works. The $((…)) arithmetic keeps
    // the asserted string out of the typed command's local echo.
    await execInTerminal(alfredPage, ptyId, 'echo live-before-$((41+1))')
    await expect
      .poll(async () => getTerminalContent(alfredPage), { timeout: 15_000 })
      .toContain('live-before-42')

    // Emulate the Chromium occlusion wedge: visibilityState pins at 'hidden',
    // one last visibilitychange fires, then the tracker goes silent forever.
    await alfredPage.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        get: () => 'hidden',
        configurable: true
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // The visible pane's pty gets marked hidden in main — the field state:
    // gate holding a pty that main's own visibility set says is visible.
    await expect
      .poll(async () => (await getDeliverySnapshot(alfredPage)).hiddenDeliveryGatedPtyCount, {
        timeout: 15_000
      })
      .toBeGreaterThan(0)
    expect(
      (await getDeliverySnapshot(alfredPage)).hiddenDeliveryGatedVisiblePtyCount
    ).toBeGreaterThan(0)

    // The freeze repro: output produced now is dropped by main, not painted.
    const droppedBefore = (await getDeliverySnapshot(alfredPage)).hiddenDeliveryDroppedChars
    await execInTerminal(alfredPage, ptyId, 'echo occluded-$((70+8))')
    await expect
      .poll(async () => (await getDeliverySnapshot(alfredPage)).hiddenDeliveryDroppedChars, {
        timeout: 15_000
      })
      .toBeGreaterThan(droppedBefore)
    expect(await getTerminalContent(alfredPage)).not.toContain('occluded-78')

    // The staleness proof: one real keystroke while the document claims
    // hidden. No visibilitychange fires — recovery must ride the proof alone.
    await alfredPage.keyboard.press('Shift')

    // Gate unlatches and the missed output repaints from the main-owned
    // snapshot — no reload, visibilityState still reads 'hidden'.
    await expect
      .poll(async () => getTerminalContent(alfredPage), { timeout: 30_000 })
      .toContain('occluded-78')
    await expect
      .poll(
        async () => (await getDeliverySnapshot(alfredPage)).hiddenDeliveryGatedVisiblePtyCount,
        {
          timeout: 15_000
        }
      )
      .toBe(0)

    // Live delivery continues under the override.
    await execInTerminal(alfredPage, ptyId, 'echo live-after-$((200+56))')
    await expect
      .poll(async () => getTerminalContent(alfredPage), { timeout: 15_000 })
      .toContain('live-after-256')

    // The one-paste freeze report is prod-reachable and carries the episode's
    // history: the stale-visibility latch and gate transitions must be in the
    // renderer breadcrumbs, and main's per-pty table must be populated.
    const report = await alfredPage.evaluate(() => window.__alfredTerminalFreezeReport?.())
    if (!report) {
      throw new Error('freeze report global missing from prod-path renderer')
    }
    expect(report.renderer.documentVisibilityProvenStale).toBe(true)
    const rendererKinds = report.renderer.breadcrumbs.map((crumb) => crumb.kind)
    expect(rendererKinds).toContain('stale-visibility-latch')
    expect(rendererKinds).toContain('renderer-gate-unmark')
    const main = z
      .object({
        diagnostics: z.object({
          perPty: z.array(z.unknown()),
          breadcrumbs: z.array(z.object({ kind: z.string() }))
        })
      })
      .parse(report.main)
    expect(main.diagnostics.perPty.length).toBeGreaterThan(0)
    const mainKinds = main.diagnostics.breadcrumbs.map((crumb) => crumb.kind)
    expect(mainKinds).toContain('gate-mark')
    expect(mainKinds).toContain('gate-unmark')
  })
})
