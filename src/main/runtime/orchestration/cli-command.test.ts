import { describe, expect, it } from 'vitest'
import { resolveTerminalOrchestrationCliCommand } from './cli-command'

describe('resolveTerminalOrchestrationCliCommand', () => {
  it('uses alfred-ide for a pane recorded as WSL', () => {
    expect(
      resolveTerminalOrchestrationCliCommand({
        connectionId: null,
        isWsl: true,
        worktreeId: 'repo::C:\\repo'
      })
    ).toBe('alfred-ide')
  })

  it('uses project runtime and WSL paths when restored pane metadata is unavailable', () => {
    expect(
      resolveTerminalOrchestrationCliCommand({
        connectionId: null,
        isWsl: null,
        worktreeId: 'repo::C:\\repo',
        projectRuntime: {
          status: 'resolved',
          runtime: {
            kind: 'wsl',
            hostPlatform: 'wsl',
            projectId: 'project',
            distro: 'Ubuntu',
            reason: 'project-override',
            cacheKey: 'project:wsl:Ubuntu'
          }
        }
      })
    ).toBe('alfred-ide')
    expect(
      resolveTerminalOrchestrationCliCommand({
        connectionId: null,
        isWsl: null,
        worktreeId: 'repo::\\\\wsl.localhost\\Ubuntu\\home\\alice\\repo'
      })
    ).toBe('alfred-ide')
  })

  it('preserves native and SSH bare-alfred commands', () => {
    expect(
      resolveTerminalOrchestrationCliCommand({
        connectionId: null,
        isWsl: false,
        worktreeId: 'repo::/home/alice/repo'
      })
    ).toBe('alfred')
    expect(
      resolveTerminalOrchestrationCliCommand({
        connectionId: 'ssh-1',
        isWsl: null,
        worktreeId: 'repo::\\\\wsl.localhost\\Ubuntu\\home\\alice\\repo'
      })
    ).toBe('alfred')
  })

  it('uses the runtime-provided command locally but never leaks it to SSH', () => {
    expect(
      resolveTerminalOrchestrationCliCommand({
        connectionId: null,
        isWsl: true,
        worktreeId: 'repo::C:\\repo',
        runtimeCliCommand: 'alfred-dev'
      })
    ).toBe('alfred-dev')
    expect(
      resolveTerminalOrchestrationCliCommand({
        connectionId: 'ssh-1',
        isWsl: true,
        worktreeId: 'repo::C:\\repo',
        runtimeCliCommand: 'alfred-dev'
      })
    ).toBe('alfred')
  })
})
