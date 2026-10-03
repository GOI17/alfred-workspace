import { expect, test } from './helpers/alfred-app'
import {
  configureGoldenStubAgent,
  getGoldenStubAgentLaunchEnv,
  GOLDEN_STUB_EXIT_MARKER,
  launchGoldenStubAgentFromNewTab
} from './helpers/golden-stub-agent'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { waitForRestoredTerminalInputReady } from './helpers/restored-terminal-input-readiness'
import {
  focusActiveTerminalInput,
  waitForActivePanePtyId,
  waitForTerminalOutput
} from './helpers/terminal'

test.use({ launchEnv: getGoldenStubAgentLaunchEnv() })

// Why: xterm renders the typed command itself, so `echo after-agent` would
// satisfy waitForTerminalOutput even if the shell never ran it. Splitting the
// marker keeps it out of the input, so a match proves real shell execution.
function buildSplitMarkerEcho(prefix: string, suffix: string): { command: string; marker: string } {
  const command =
    process.platform === 'win32'
      ? `Write-Output ('${prefix}' + '${suffix}')`
      : `echo "${prefix}""${suffix}"`
  return { command, marker: `${prefix}${suffix}` }
}

test('opens a clean live shell after an agent exits', async ({ alfredPage }) => {
  await waitForSessionReady(alfredPage)
  await waitForActiveWorktree(alfredPage)
  await ensureTerminalVisible(alfredPage)
  await configureGoldenStubAgent(alfredPage)
  await launchGoldenStubAgentFromNewTab(alfredPage)

  await alfredPage.keyboard.type('exit')
  await alfredPage.keyboard.press('Enter')
  await waitForTerminalOutput(alfredPage, GOLDEN_STUB_EXIT_MARKER, 15_000)

  const tabsBeforeShell = await alfredPage.locator('[data-testid="sortable-tab"]').count()
  await alfredPage.getByRole('button', { name: 'New tab' }).click({ force: true })
  await alfredPage
    .getByRole('menuitem', { name: /New Terminal/i })
    .first()
    .click({ force: true })
  await expect(alfredPage.locator('[data-testid="sortable-tab"]')).toHaveCount(tabsBeforeShell + 1)
  const shellPtyId = await waitForActivePanePtyId(alfredPage)
  // Why: a bound ptyId only means the pane exists; the renderer transport can
  // still drop keystrokes until it connects, which would strand the markers.
  expect(await waitForRestoredTerminalInputReady(alfredPage, shellPtyId)).toBe(true)

  const afterAgent = buildSplitMarkerEcho('after-', 'agent')
  await focusActiveTerminalInput(alfredPage)
  await alfredPage.keyboard.type(afterAgent.command)
  await alfredPage.keyboard.press('Enter')
  await waitForTerminalOutput(alfredPage, afterAgent.marker, 15_000)

  const afterShiftEnter = buildSplitMarkerEcho('after-shift-', 'enter')
  await alfredPage.keyboard.press('Shift+Enter')
  await alfredPage.keyboard.type(afterShiftEnter.command)
  await alfredPage.keyboard.press('Enter')
  await waitForTerminalOutput(alfredPage, afterShiftEnter.marker, 15_000)
  await expect(alfredPage.locator('[data-testid="sortable-tab"]')).toHaveCount(tabsBeforeShell + 1)
})
