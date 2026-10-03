import { getDefaultRuntimeClientSettings } from './runtime-client-settings-test-fixture'
import { createRuntimeServiceTestDouble } from './runtime-service-test-double'
import { vi } from 'vitest'
import type { Mock } from 'vitest'

// Loose on purpose: the allowlist suite asserts call arguments, never RPC signatures.
export type MobileRpcMock = Mock<(...args: unknown[]) => unknown>

// Full mobile-surface runtime double: every RPC the mobile allowlist may reach.
type MobileRuntimeMocks = {
  getStatus: MobileRpcMock
  pushRuntimeGit: MobileRpcMock
  selectClaudeAccount: MobileRpcMock
  selectCodexAccount: MobileRpcMock
  consumeCodexRateLimitResetCredit: MobileRpcMock
  removeClaudeAccount: MobileRpcMock
  readTerminal: MobileRpcMock
  getRuntimeGitStatus: MobileRpcMock
  getRuntimeGitUpstreamStatus: MobileRpcMock
  rebaseRuntimeGitFromBase: MobileRpcMock
  abortRuntimeGitMerge: MobileRpcMock
  abortRuntimeGitRebase: MobileRpcMock
  bulkStageRuntimeGitPaths: MobileRpcMock
  bulkUnstageRuntimeGitPaths: MobileRpcMock
  getRuntimeGitDiff: MobileRpcMock
  openMobileDiff: MobileRpcMock
  browserTabCreate: MobileRpcMock
  browserSetViewport: MobileRpcMock
  browserDialogAccept: MobileRpcMock
  browserDialogDismiss: MobileRpcMock
  listGitHubProjects: MobileRpcMock
  listGitHubLabelsBySlug: MobileRpcMock
  listGitHubAssignableUsersBySlug: MobileRpcMock
  listGitHubIssueTypesBySlug: MobileRpcMock
  updateGitHubProjectItemField: MobileRpcMock
  clearGitHubProjectItemField: MobileRpcMock
  updateGitHubIssueBySlug: MobileRpcMock
  updateGitHubIssueTypeBySlug: MobileRpcMock
  updateGitHubPullRequestBySlug: MobileRpcMock
  updateRepoIssue: MobileRpcMock
  listRepoLabels: MobileRpcMock
  listRepoAssignableUsers: MobileRpcMock
  addRepoIssueComment: MobileRpcMock
  addRepoPRReviewComment: MobileRpcMock
  addRepoPRReviewCommentReply: MobileRpcMock
  getRepoPRFileContents: MobileRpcMock
  rerunRepoPRChecks: MobileRpcMock
  resolveRepoReviewThread: MobileRpcMock
  setRepoPRFileViewed: MobileRpcMock
  requestRepoPRReviewers: MobileRpcMock
  mergeRepoPR: MobileRpcMock
  addGitLabRepoIssueComment: MobileRpcMock
  addGitLabRepoMRComment: MobileRpcMock
  resolveGitLabRepoMRDiscussion: MobileRpcMock
  mergeGitLabRepoMR: MobileRpcMock
  addGitHubIssueCommentBySlug: MobileRpcMock
  updateGitHubIssueCommentBySlug: MobileRpcMock
  deleteGitHubIssueCommentBySlug: MobileRpcMock
  linearSearchIssues: MobileRpcMock
  linearSelectWorkspace: MobileRpcMock
  linearTeamLabels: MobileRpcMock
  linearTeamMembers: MobileRpcMock
  linearAddIssueComment: MobileRpcMock
  getClientSettings: MobileRpcMock
  updateClientSettings: MobileRpcMock
  getRuntimeId(): string
  configureNotificationDismissalStore(): void
}

export function createMobileRpcSurfaceRuntime(): {
  runtime: ReturnType<typeof createRuntimeServiceTestDouble>
  mocks: MobileRuntimeMocks
  expectedCodexResetScope: {
    target: { runtime: 'host'; wslDistro: null }
    accountId: string
    accountRevision: number
    offerRevision: string
  }
} {
  const getStatus = vi.fn().mockResolvedValue({ graphStatus: 'ok' })
  const pushRuntimeGit = vi.fn().mockResolvedValue({ ok: true })
  const selectClaudeAccount = vi.fn().mockResolvedValue({ ok: true })
  const selectCodexAccount = vi.fn().mockResolvedValue({ ok: true })
  const expectedCodexResetScope = {
    target: { runtime: 'host' as const, wslDistro: null },
    accountId: 'codex-account',
    accountRevision: 42,
    offerRevision: 'v1:offer'
  }
  const consumeCodexRateLimitResetCredit = vi.fn().mockResolvedValue({
    outcome: 'reset',
    scope: expectedCodexResetScope,
    snapshot: { claude: null, codex: null }
  })
  const removeClaudeAccount = vi.fn().mockResolvedValue({ ok: true })
  const readTerminal = vi.fn().mockResolvedValue({ tail: ['ok'] })
  const getRuntimeGitStatus = vi
    .fn()
    .mockResolvedValue({ entries: [], conflictOperation: 'unknown' })
  const getRuntimeGitUpstreamStatus = vi
    .fn()
    .mockResolvedValue({ hasUpstream: true, ahead: 1, behind: 0 })
  const rebaseRuntimeGitFromBase = vi.fn().mockResolvedValue({ ok: true })
  const abortRuntimeGitMerge = vi.fn().mockResolvedValue({ ok: true })
  const abortRuntimeGitRebase = vi.fn().mockResolvedValue({ ok: true })
  const bulkStageRuntimeGitPaths = vi.fn().mockResolvedValue({ ok: true })
  const bulkUnstageRuntimeGitPaths = vi.fn().mockResolvedValue({ ok: true })
  const getRuntimeGitDiff = vi.fn().mockResolvedValue({
    kind: 'text',
    originalContent: 'before\n',
    modifiedContent: 'after\n',
    originalIsBinary: false,
    modifiedIsBinary: false
  })
  const openMobileDiff = vi.fn().mockResolvedValue({
    worktree: 'wt-1',
    relativePath: 'docs/readme.md',
    kind: 'markdown',
    opened: true
  })
  const browserTabCreate = vi.fn().mockResolvedValue({ page: 'page-1' })
  const browserSetViewport = vi.fn().mockResolvedValue({ ok: true })
  const browserDialogAccept = vi.fn().mockResolvedValue({ ok: true })
  const browserDialogDismiss = vi.fn().mockResolvedValue({ ok: true })
  const listGitHubProjects = vi.fn().mockResolvedValue({ ok: true, projects: [] })
  const listGitHubLabelsBySlug = vi.fn().mockResolvedValue({ ok: true, labels: ['bug'] })
  const listGitHubAssignableUsersBySlug = vi
    .fn()
    .mockResolvedValue({ ok: true, users: [{ login: 'alex' }] })
  const listGitHubIssueTypesBySlug = vi.fn().mockResolvedValue({
    ok: true,
    types: [{ id: 'type-1', name: 'Bug', color: 'RED', description: null }]
  })
  const updateGitHubProjectItemField = vi.fn().mockResolvedValue({ ok: true })
  const clearGitHubProjectItemField = vi.fn().mockResolvedValue({ ok: true })
  const updateGitHubIssueBySlug = vi.fn().mockResolvedValue({ ok: true })
  const updateGitHubIssueTypeBySlug = vi.fn().mockResolvedValue({ ok: true })
  const updateGitHubPullRequestBySlug = vi.fn().mockResolvedValue({ ok: true })
  const updateRepoIssue = vi.fn().mockResolvedValue({ ok: true })
  const listRepoLabels = vi.fn().mockResolvedValue(['bug'])
  const listRepoAssignableUsers = vi.fn().mockResolvedValue([{ login: 'alex' }])
  const addRepoIssueComment = vi.fn().mockResolvedValue({ ok: true, comment: { id: 2 } })
  const addRepoPRReviewComment = vi.fn().mockResolvedValue({ ok: true, comment: { id: 3 } })
  const addRepoPRReviewCommentReply = vi.fn().mockResolvedValue({
    ok: true,
    comment: { id: 4 }
  })
  const getRepoPRFileContents = vi.fn().mockResolvedValue({
    original: 'before',
    modified: 'after',
    originalIsBinary: false,
    modifiedIsBinary: false
  })
  const rerunRepoPRChecks = vi.fn().mockResolvedValue({ ok: true, count: 1 })
  const resolveRepoReviewThread = vi.fn().mockResolvedValue(true)
  const setRepoPRFileViewed = vi.fn().mockResolvedValue(true)
  const requestRepoPRReviewers = vi.fn().mockResolvedValue({ ok: true })
  const mergeRepoPR = vi.fn().mockResolvedValue({ ok: true })
  const addGitLabRepoIssueComment = vi.fn().mockResolvedValue({ ok: true })
  const addGitLabRepoMRComment = vi.fn().mockResolvedValue({ ok: true })
  const resolveGitLabRepoMRDiscussion = vi.fn().mockResolvedValue({ ok: true })
  const mergeGitLabRepoMR = vi.fn().mockResolvedValue({ ok: true })
  const addGitHubIssueCommentBySlug = vi.fn().mockResolvedValue({
    ok: true,
    comment: { id: 1, author: 'me', body: 'done', createdAt: '2026-01-01T00:00:00Z', url: '' }
  })
  const updateGitHubIssueCommentBySlug = vi.fn().mockResolvedValue({ ok: true })
  const deleteGitHubIssueCommentBySlug = vi.fn().mockResolvedValue({ ok: true })
  const linearSearchIssues = vi.fn().mockResolvedValue([])
  const linearSelectWorkspace = vi.fn().mockReturnValue({
    connected: true,
    selectedWorkspaceId: 'workspace-1'
  })
  const linearTeamLabels = vi.fn().mockResolvedValue([{ id: 'label-1', name: 'bug' }])
  const linearTeamMembers = vi.fn().mockResolvedValue([{ id: 'member-1', displayName: 'Alex' }])
  const linearAddIssueComment = vi.fn().mockResolvedValue({ ok: true, id: 'comment-1' })
  const runtime = {
    configureNotificationDismissalStore: () => {},
    getRuntimeId: () => 'test-runtime',
    getStatus,
    pushRuntimeGit,
    selectClaudeAccount,
    selectCodexAccount,
    consumeCodexRateLimitResetCredit,
    removeClaudeAccount,
    readTerminal,
    getRuntimeGitStatus,
    getRuntimeGitUpstreamStatus,
    rebaseRuntimeGitFromBase,
    abortRuntimeGitMerge,
    abortRuntimeGitRebase,
    bulkStageRuntimeGitPaths,
    bulkUnstageRuntimeGitPaths,
    getRuntimeGitDiff,
    openMobileDiff,
    browserTabCreate,
    browserSetViewport,
    browserDialogAccept,
    browserDialogDismiss,
    listGitHubProjects,
    listGitHubLabelsBySlug,
    listGitHubAssignableUsersBySlug,
    listGitHubIssueTypesBySlug,
    updateGitHubProjectItemField,
    clearGitHubProjectItemField,
    updateGitHubIssueBySlug,
    updateGitHubIssueTypeBySlug,
    updateGitHubPullRequestBySlug,
    updateRepoIssue,
    listRepoLabels,
    listRepoAssignableUsers,
    addRepoIssueComment,
    addRepoPRReviewComment,
    addRepoPRReviewCommentReply,
    getRepoPRFileContents,
    rerunRepoPRChecks,
    resolveRepoReviewThread,
    setRepoPRFileViewed,
    requestRepoPRReviewers,
    mergeRepoPR,
    addGitLabRepoIssueComment,
    addGitLabRepoMRComment,
    resolveGitLabRepoMRDiscussion,
    mergeGitLabRepoMR,
    addGitHubIssueCommentBySlug,
    updateGitHubIssueCommentBySlug,
    deleteGitHubIssueCommentBySlug,
    linearSearchIssues,
    linearSelectWorkspace,
    linearTeamLabels,
    linearTeamMembers,
    linearAddIssueComment,
    getClientSettings: vi.fn(() => ({
      ...getDefaultRuntimeClientSettings(),
      defaultTuiAgent: 'codex' as const,
      agentCmdOverrides: {}
    })),
    updateClientSettings: vi.fn(async () => ({
      ...getDefaultRuntimeClientSettings(),
      defaultTaskSource: 'linear' as const
    }))
  }
  return {
    runtime: createRuntimeServiceTestDouble(runtime),
    mocks: runtime,
    expectedCodexResetScope
  }
}
