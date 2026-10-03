import { expect, test } from './helpers/alfred-app'
import {
  configureGoldenStubAgent,
  getGoldenStubAgentLaunchEnv,
  launchGoldenStubAgentFromNewTab
} from './helpers/golden-stub-agent'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { focusActiveTerminalInput, getTerminalContent } from './helpers/terminal'

test.use({ launchEnv: getGoldenStubAgentLaunchEnv() })

test('launches an agent TUI with a live multiline composer', async ({ alfredPage }) => {
  await waitForSessionReady(alfredPage)
  await waitForActiveWorktree(alfredPage)
  await ensureTerminalVisible(alfredPage)
  await configureGoldenStubAgent(alfredPage)
  await launchGoldenStubAgentFromNewTab(alfredPage)

  const activeTab = alfredPage.locator('[data-testid="sortable-tab"][data-active="true"]')
  await expect(activeTab).toHaveAttribute('data-tab-title', /Codex|Golden Stub Agent/i)

  await focusActiveTerminalInput(alfredPage)
  await alfredPage.keyboard.type('hello from e2e')
  await alfredPage.keyboard.press('Shift+Enter')
  await alfredPage.keyboard.type('second line')

  await expect
    .poll(() => getTerminalContent(alfredPage), { timeout: 10_000 })
    .toContain('> hello from e2e\r\n  second line')
  expect(await getTerminalContent(alfredPage)).not.toContain('GOLDEN_STUB_AGENT_SUBMITTED')
})
