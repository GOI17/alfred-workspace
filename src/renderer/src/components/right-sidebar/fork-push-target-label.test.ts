import { describe, expect, it } from 'vitest'
import type { GitPushTarget } from '../../../../shared/worktree/types'
import { describeForkPushTarget } from './source-control/panel/fork-push-target-label'

function target(overrides: Partial<GitPushTarget>): GitPushTarget {
  return {
    remoteName: 'pr-contributor-alfred',
    branchName: 'contributor/fix',
    ...overrides
  }
}

describe('describeForkPushTarget', () => {
  it('derives owner:branch from an SSH fork URL', () => {
    expect(
      describeForkPushTarget(target({ remoteUrl: 'git@github.com:contributor/alfred.git' }))
    ).toBe('contributor:contributor/fix')
  })

  it('derives owner:branch from an HTTPS fork URL', () => {
    expect(
      describeForkPushTarget(target({ remoteUrl: 'https://github.com/contributor/alfred.git' }))
    ).toBe('contributor:contributor/fix')
  })

  it('handles a URL without a .git suffix', () => {
    expect(
      describeForkPushTarget(target({ remoteUrl: 'https://github.com/contributor/alfred' }))
    ).toBe('contributor:contributor/fix')
  })

  it('falls back to remoteName/branch when there is no remote URL', () => {
    expect(describeForkPushTarget(target({ remoteUrl: undefined }))).toBe(
      'pr-contributor-alfred/contributor/fix'
    )
  })

  it('works for non-GitHub hosts via the generic owner segment', () => {
    expect(
      describeForkPushTarget(target({ remoteUrl: 'git@gitlab.com:contributor/alfred.git' }))
    ).toBe('contributor:contributor/fix')
  })
})
