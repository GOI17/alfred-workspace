import { describe, expect, it } from 'vitest'
import { shouldUseShellReadyStartupDelivery } from '../../../shared/codex-startup-delivery'
import { CODEX_ACCOUNT_RESTART_STARTUP } from './codex-session-restart'

describe('CODEX_ACCOUNT_RESTART_STARTUP', () => {
  it('waits for shell readiness before relaunching Codex after an account switch', () => {
    // Why launchAgent is load-bearing: pty:spawn runs the managed-auth
    // readiness gate and Codex launch prep only for launchAgent 'codex', so
    // dropping it would let a restart respawn race the account handoff and
    // record a launch account the pane does not actually read.
    expect(CODEX_ACCOUNT_RESTART_STARTUP).toEqual({
      command: 'codex',
      startupCommandDelivery: 'shell-ready',
      launchAgent: 'codex'
    })
    expect(shouldUseShellReadyStartupDelivery(CODEX_ACCOUNT_RESTART_STARTUP)).toBe(true)
  })
})
