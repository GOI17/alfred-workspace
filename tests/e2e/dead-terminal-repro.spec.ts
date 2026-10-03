/**
 * Stress test for dead-terminal reproduction (setup-split flow).
 *
 * Why @headful: the dead-terminal bug is a WebGL canvas staleness issue — after
 * wrapInSplit() reparents the existing pane's container, the WebGL canvas can
 * fail to repaint. In headless mode WebGL is NEVER active, so the DOM fallback
 * renderer is used and the bug cannot manifest. Running headful ensures real
 * WebGL contexts matching production.
 *
 * See helpers/dead-terminal.ts for the shared worktree-creation helper that
 * replicates the exact activateAndRevealWorktree + ensureWorktreeHasInitialTerminal
 * production flow.
 */

import { test, expect } from './helpers/alfred-app'
import {
  waitForSessionReady,
  waitForActiveWorktree,
  getActiveWorktreeId,
  switchToWorktree,
  ensureTerminalVisible
} from './helpers/store'
import { waitForActiveTerminalManager, waitForPaneCount } from './helpers/terminal'
import {
  createAndActivateWorktreeWithSetup,
  removeWorktreeViaStore,
  waitForAllPanesToHaveContent,
  checkWebglState
} from './helpers/dead-terminal'

const STRESS_ITERATIONS = 5

test.describe('Dead Terminal Reproduction @headful', () => {
  const createdWorktreeIds: string[] = []

  test.beforeEach(async ({ alfredPage }) => {
    await waitForSessionReady(alfredPage)
    await waitForActiveWorktree(alfredPage)
    await ensureTerminalVisible(alfredPage)

    await alfredPage.evaluate(async () => {
      const state = window.__store?.getState()
      if (!state) {
        return
      }
      state.updateSettings({ setupScriptLaunchMode: 'split-vertical' })
    })
  })

  test.afterEach(async ({ alfredPage }) => {
    for (const id of createdWorktreeIds) {
      await removeWorktreeViaStore(alfredPage, id)
    }
    createdWorktreeIds.length = 0
  })

  test('@headful setup-split flow does not produce dead terminals', async ({ alfredPage }) => {
    test.setTimeout(120_000)
    const homeWorktreeId = await waitForActiveWorktree(alfredPage)
    await waitForActiveTerminalManager(alfredPage, 30_000)
    await checkWebglState(alfredPage, 'home-initial')

    for (let i = 0; i < STRESS_ITERATIONS; i++) {
      const direction = i % 2 === 0 ? 'vertical' : 'horizontal'
      const newId = await createAndActivateWorktreeWithSetup(alfredPage, `setup-${i}`, direction)
      createdWorktreeIds.push(newId)

      await expect
        .poll(async () => getActiveWorktreeId(alfredPage), { timeout: 10_000 })
        .toBe(newId)
      await ensureTerminalVisible(alfredPage)
      await waitForActiveTerminalManager(alfredPage, 30_000)
      await waitForPaneCount(alfredPage, 2, 15_000)
      await checkWebglState(alfredPage, `setup-${i}`)
      await waitForAllPanesToHaveContent(alfredPage, `setup-${i} both panes`)

      await switchToWorktree(alfredPage, homeWorktreeId)
      await expect
        .poll(async () => getActiveWorktreeId(alfredPage), { timeout: 10_000 })
        .toBe(homeWorktreeId)
      await removeWorktreeViaStore(alfredPage, newId)
      createdWorktreeIds.pop()
    }
  })

  test('@headful setup-split then switch-back does not leave panes dead', async ({
    alfredPage
  }) => {
    test.setTimeout(120_000)
    const homeWorktreeId = await waitForActiveWorktree(alfredPage)
    await waitForActiveTerminalManager(alfredPage, 30_000)

    for (let i = 0; i < STRESS_ITERATIONS; i++) {
      const newId = await createAndActivateWorktreeWithSetup(
        alfredPage,
        `switchback-${i}`,
        'vertical'
      )
      createdWorktreeIds.push(newId)

      await expect
        .poll(async () => getActiveWorktreeId(alfredPage), { timeout: 10_000 })
        .toBe(newId)
      await ensureTerminalVisible(alfredPage)
      await waitForActiveTerminalManager(alfredPage, 30_000)
      await waitForPaneCount(alfredPage, 2, 15_000)
      await waitForAllPanesToHaveContent(alfredPage, `switchback-${i} initial`)

      await switchToWorktree(alfredPage, homeWorktreeId)
      await expect
        .poll(async () => getActiveWorktreeId(alfredPage), { timeout: 10_000 })
        .toBe(homeWorktreeId)
      await ensureTerminalVisible(alfredPage)
      await waitForActiveTerminalManager(alfredPage, 15_000)

      await switchToWorktree(alfredPage, newId)
      await expect
        .poll(async () => getActiveWorktreeId(alfredPage), { timeout: 10_000 })
        .toBe(newId)
      await ensureTerminalVisible(alfredPage)
      await waitForActiveTerminalManager(alfredPage, 15_000)
      await waitForAllPanesToHaveContent(alfredPage, `switchback-${i} after return`)

      await switchToWorktree(alfredPage, homeWorktreeId)
      await expect
        .poll(async () => getActiveWorktreeId(alfredPage), { timeout: 10_000 })
        .toBe(homeWorktreeId)
      await removeWorktreeViaStore(alfredPage, newId)
      createdWorktreeIds.pop()
    }
  })

  test('@headful rapid switching between many setup-split worktrees', async ({ alfredPage }) => {
    test.setTimeout(120_000)
    const homeWorktreeId = await waitForActiveWorktree(alfredPage)
    await waitForActiveTerminalManager(alfredPage, 30_000)

    const worktreeIds = [homeWorktreeId]
    for (let i = 0; i < 4; i++) {
      const newId = await createAndActivateWorktreeWithSetup(alfredPage, `multi-${i}`, 'vertical')
      createdWorktreeIds.push(newId)
      worktreeIds.push(newId)

      await expect
        .poll(async () => getActiveWorktreeId(alfredPage), { timeout: 10_000 })
        .toBe(newId)
      await ensureTerminalVisible(alfredPage)
      await waitForActiveTerminalManager(alfredPage, 30_000)
      await waitForPaneCount(alfredPage, 2, 15_000)
      await waitForAllPanesToHaveContent(alfredPage, `multi-create-${i}`)
    }

    for (let round = 0; round < 3; round++) {
      for (const wId of worktreeIds) {
        await switchToWorktree(alfredPage, wId)
        await expect
          .poll(async () => getActiveWorktreeId(alfredPage), { timeout: 10_000 })
          .toBe(wId)
        await ensureTerminalVisible(alfredPage)
        await waitForActiveTerminalManager(alfredPage, 15_000)
        await waitForAllPanesToHaveContent(alfredPage, `multi-r${round}-${wId.slice(0, 8)}`)
      }
    }
  })
})
