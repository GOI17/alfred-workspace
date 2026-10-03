import { describe, expect, it } from 'vitest'
import { pickRemoteCliEnv } from './remote-cli-env'

describe('pickRemoteCliEnv', () => {
  it('forwards SSH Alfred terminal and worktree context for remote CLI calls', () => {
    expect(
      pickRemoteCliEnv({
        ALFRED_TERMINAL_HANDLE: 'term_ssh',
        ALFRED_WORKTREE_ID: 'repo::remote',
        ALFRED_PANE_KEY: 'pane-1',
        ALFRED_AGENT_LAUNCH_TOKEN: 'launch-secret',
        ALFRED_WORKSPACE_ID: 'workspace-1',
        ALFRED_USER_DATA_PATH: '/tmp/alfred',
        PATH: '/usr/bin',
        SECRET_TOKEN: 'nope'
      })
    ).toEqual({
      ALFRED_TERMINAL_HANDLE: 'term_ssh',
      ALFRED_WORKTREE_ID: 'repo::remote',
      ALFRED_PANE_KEY: 'pane-1',
      ALFRED_AGENT_LAUNCH_TOKEN: 'launch-secret',
      ALFRED_WORKSPACE_ID: 'workspace-1',
      ALFRED_USER_DATA_PATH: '/tmp/alfred',
      PATH: '/usr/bin'
    })
  })
})
