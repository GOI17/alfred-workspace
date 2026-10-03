import type { Worktree } from './types'

export function makeWorktree(overrides: Partial<Worktree> = {}): Worktree {
  return {
    id: 'workspace-1',
    repoId: 'repo-1',
    displayName: 'main',
    path: '/repos/alfred',
    branch: 'main',
    head: 'abc123',
    isBare: false,
    isMainWorktree: true,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    ...overrides
  }
}
