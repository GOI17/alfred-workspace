import { writeFile } from 'node:fs/promises'
import { buildShellCommandFromArgv } from '../../src/shared/tui-agent-startup-shell'
import { test, expect } from './helpers/alfred-app'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import {
  execInTerminal,
  sendToTerminal,
  waitForActivePanePtyId,
  waitForActiveTerminalManager
} from './helpers/terminal'

test('OMP spaced-colon title renders working and clears on idle', async ({
  alfredPage
}, testInfo) => {
  test.skip(
    process.platform === 'win32',
    'POSIX title replay; Windows formatter bytes have separate coverage'
  )
  await waitForSessionReady(alfredPage)
  await waitForActiveWorktree(alfredPage)
  await ensureTerminalVisible(alfredPage)
  await waitForActiveTerminalManager(alfredPage)
  const ptyId = await waitForActivePanePtyId(alfredPage)
  const script = testInfo.outputPath('title-replay.cjs')
  await writeFile(
    script,
    `
process.stdout.write('\\x1b]0;OMP : Image review\\x07')
process.stdin.on('data', () => process.stdout.write('\\x1b]0;OMP > Image review\\x07'))
`
  )
  await execInTerminal(
    alfredPage,
    ptyId,
    buildShellCommandFromArgv([process.execPath, script], 'posix')
  )
  const working = alfredPage.locator('[aria-label="Working"]')
  await expect(working.first()).toBeVisible({ timeout: 15000 })
  await alfredPage.screenshot({ path: testInfo.outputPath('omp-title-working.png') })
  await sendToTerminal(alfredPage, ptyId, '\r')
  await expect(working).toHaveCount(0)
  await alfredPage.screenshot({ path: testInfo.outputPath('omp-title-idle.png') })
})
