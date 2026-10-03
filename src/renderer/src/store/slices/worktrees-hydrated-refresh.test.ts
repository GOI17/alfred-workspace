import { makeRepo as completeMakeRepo } from '../../../../shared/repo-test-fixture'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RuntimeEnvironmentCallRequest } from '../../runtime/runtime-compatibility-test-fixture'
import { WORKTREE_REFRESH_CONCURRENCY } from './worktrees'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'

import { makeDetectedResult } from './worktrees-detected-listing-fixtures'
import { makeWorktree } from './worktrees-slice-test-fixtures'
import {
  createTestStore,
  mockApi,
  resetRemoteRuntimeMocks,
  resetWorktreeSliceModuleMemory,
  runtimeEnvironmentCall,
  runtimeEnvironmentTransportCall
} from './worktrees-slice-test-harness'

const requestWorktreeBaseFallbackNotice = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn()
  }
}))

vi.mock('@/components/worktree-base-fallback-notice', () => ({
  requestWorktreeBaseFallbackNotice
}))

beforeEach(resetWorktreeSliceModuleMemory)

// Why: design §4.4 — hydration purge gated on per-repo success (F1 regression) so a git error can't wipe tabsByWorktree.
describe('fetchAllWorktrees after hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetRemoteRuntimeMocks()
  })

  const repoA = {
    id: 'repoA',
    path: '/repos/a',
    displayName: 'a',
    badgeColor: '#000',
    addedAt: 0
  }
  const repoB = {
    id: 'repoB',
    path: '/repos/b',
    displayName: 'b',
    badgeColor: '#111',
    addedAt: 0
  }

  it('does not purge another host tab state when hasHydratedWorktreePurge is already true and a host reports zero worktrees', async () => {
    const store = createTestStore()
    const wtA = makeWorktree({ id: 'repoA::/a/wt1', repoId: 'repoA', path: '/a/wt1' })

    // repoB reports zero worktrees this round (host briefly empty), repoA fine.
    mockApi.worktrees.list.mockImplementation(async ({ repoId }: { repoId: string }) =>
      repoId === 'repoA' ? [wtA] : []
    )

    store.setState({
      hasHydratedWorktreePurge: true,
      repos: [repoA, repoB],
      tabsByWorktree: {
        'repoB::/b/wt1': [
          {
            ptyId: null,
            title: 'Terminal',
            customTitle: null,
            color: null,
            sortOrder: 0,
            createdAt: 1,
            id: 'tab-B',
            worktreeId: 'repoB::/b/wt1'
          }
        ]
      },
      ptyIdsByTabId: { 'tab-B': ['remote:env-b@@terminal-b'] },
      terminalLayoutsByTabId: {
        'tab-B': {
          root: null,
          activeLeafId: null,
          expandedLeafId: null,
          ptyIdsByLeafId: { 'pane:1': 'remote:env-b@@terminal-b' }
        }
      }
    })

    await store.getState().fetchAllWorktrees()

    // The zero-worktree host's live tab/terminal state is untouched.
    expect(store.getState().tabsByWorktree).toEqual({
      'repoB::/b/wt1': [
        {
          ptyId: null,
          title: 'Terminal',
          customTitle: null,
          color: null,
          sortOrder: 0,
          createdAt: 1,
          id: 'tab-B',
          worktreeId: 'repoB::/b/wt1'
        }
      ]
    })
    expect(store.getState().ptyIdsByTabId).toEqual({ 'tab-B': ['remote:env-b@@terminal-b'] })
    expect(store.getState().terminalLayoutsByTabId).toEqual({
      'tab-B': {
        root: null,
        activeLeafId: null,
        expandedLeafId: null,
        ptyIdsByLeafId: { 'pane:1': 'remote:env-b@@terminal-b' }
      }
    })
    expect(store.getState().hasHydratedWorktreePurge).toBe(true)
  })

  it('preserves sibling host worktrees during hydrated refresh when repo ids are duplicated', async () => {
    const store = createTestStore()
    const localRepo = {
      id: 'same-repo',
      path: '/repos/local',
      displayName: 'same local',
      badgeColor: '#000',
      addedAt: 0,
      executionHostId: 'local' as const
    }
    const runtimeRepo = {
      id: 'same-repo',
      path: '/repos/remote',
      displayName: 'same remote',
      badgeColor: '#111',
      addedAt: 1,
      executionHostId: 'runtime:env-1' as const
    }
    const localWorktree = makeWorktree({
      id: 'same-repo::/local/wt',
      repoId: 'same-repo',
      path: '/local/wt'
    })
    const staleRemoteWorktree = makeWorktree({
      id: 'same-repo::/remote/stale',
      repoId: 'same-repo',
      path: '/remote/stale',
      hostId: 'runtime:env-1'
    })
    const refreshedRemoteWorktree = makeWorktree({
      id: 'same-repo::/remote/fresh',
      repoId: 'same-repo',
      path: '/remote/fresh',
      hostId: 'local'
    })

    mockApi.worktrees.listDetected.mockResolvedValueOnce(
      makeDetectedResult('same-repo', [localWorktree])
    )
    runtimeEnvironmentCall.mockResolvedValue({
      id: 'rpc-duplicate-worktrees',
      ok: true,
      result: makeDetectedResult('same-repo', [refreshedRemoteWorktree]),
      _meta: { runtimeId: 'runtime-remote' }
    })

    store.setState({
      hasHydratedWorktreePurge: true,
      repos: [localRepo, runtimeRepo],
      worktreesByRepo: {
        'same-repo': [localWorktree, staleRemoteWorktree]
      },
      detectedWorktreesByRepo: {
        'same-repo': makeDetectedResult('same-repo', [localWorktree, staleRemoteWorktree])
      }
    })

    await store.getState().fetchAllWorktrees()

    const refreshed = store.getState().worktreesByRepo['same-repo'] ?? []
    expect(refreshed).toHaveLength(2)
    expect(refreshed).toEqual(
      expect.arrayContaining([
        localWorktree,
        {
          ...refreshedRemoteWorktree,
          hostId: 'runtime:env-1',
          runtimeOwnerEnvironmentId: 'env-1'
        }
      ])
    )
    expect(refreshed.map((worktree) => worktree.id)).not.toContain(staleRemoteWorktree.id)
    expect(store.getState().detectedWorktreesByRepo['same-repo']?.worktrees).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: localWorktree.id }),
        expect.objectContaining({ id: refreshedRemoteWorktree.id, hostId: 'runtime:env-1' })
      ])
    )
    expect(mockApi.worktrees.listDetected).toHaveBeenCalledWith(
      expect.objectContaining({
        repoId: 'same-repo',
        executionHostId: 'local' as const
      })
    )
    expect(runtimeEnvironmentCall).toHaveBeenCalledWith({
      selector: 'env-1',
      method: 'worktree.detectedList',
      params: { repo: 'same-repo' },
      timeoutMs: 15_000
    })
  })

  it('bounds concurrent repo scans during hydration-time refresh', async () => {
    const store = createTestStore()
    const repos = Array.from({ length: WORKTREE_REFRESH_CONCURRENCY + 2 }, (_, index) => ({
      id: `repo-${index}`,
      path: `/repos/${index}`,
      displayName: `repo-${index}`,
      badgeColor: '#000',
      addedAt: 0
    }))
    let activeScans = 0
    let maxActiveScans = 0

    mockApi.worktrees.list.mockImplementation(async ({ repoId }: { repoId: string }) => {
      activeScans += 1
      maxActiveScans = Math.max(maxActiveScans, activeScans)
      await new Promise((resolve) => setTimeout(resolve, 5))
      activeScans -= 1
      return [makeWorktree({ id: `${repoId}::/wt`, repoId, path: `/wt/${repoId}` })]
    })

    store.setState({ repos })

    await store.getState().fetchAllWorktrees()

    expect(maxActiveScans).toBeLessThanOrEqual(WORKTREE_REFRESH_CONCURRENCY)
    expect(mockApi.worktrees.list).toHaveBeenCalledTimes(repos.length)
    expect(store.getState().hasHydratedWorktreePurge).toBe(true)
  })

  it('bounds concurrent repo scans after the hydration purge has run', async () => {
    const store = createTestStore()
    const repos = Array.from({ length: WORKTREE_REFRESH_CONCURRENCY + 2 }, (_, index) => ({
      id: `repo-${index}`,
      path: `/repos/${index}`,
      displayName: `repo-${index}`,
      badgeColor: '#000',
      addedAt: 0
    }))
    let activeScans = 0
    let maxActiveScans = 0

    mockApi.worktrees.list.mockImplementation(async ({ repoId }: { repoId: string }) => {
      activeScans += 1
      maxActiveScans = Math.max(maxActiveScans, activeScans)
      await new Promise((resolve) => setTimeout(resolve, 5))
      activeScans -= 1
      return [makeWorktree({ id: `${repoId}::/wt`, repoId, path: `/wt/${repoId}` })]
    })

    store.setState({
      hasHydratedWorktreePurge: true,
      repos
    })

    await store.getState().fetchAllWorktrees()

    expect(maxActiveScans).toBeLessThanOrEqual(WORKTREE_REFRESH_CONCURRENCY)
    expect(mockApi.worktrees.list).toHaveBeenCalledTimes(repos.length)
    expect(store.getState().hasHydratedWorktreePurge).toBe(true)
  })

  it('reuses an offline runtime preflight across hydrated all-worktree refresh repos', async () => {
    const store = createTestStore()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const repos = Array.from({ length: WORKTREE_REFRESH_CONCURRENCY + 2 }, (_, index) => ({
      id: `runtime-repo-${index}`,
      path: `/remote/repos/${index}`,
      displayName: `runtime-repo-${index}`,
      badgeColor: '#000',
      addedAt: 0,
      executionHostId: 'runtime:env-offline' as const
    }))

    runtimeEnvironmentTransportCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
      if (args.method === 'status.get') {
        return Promise.resolve({
          id: 'status',
          ok: false,
          error: { code: 'runtime_unavailable', message: 'offline' },
          _meta: { runtimeId: 'runtime-offline' }
        })
      }
      return runtimeEnvironmentCall(args)
    })

    try {
      store.setState({
        hasHydratedWorktreePurge: true,
        repos
      })

      await store.getState().fetchAllWorktrees()
    } finally {
      consoleError.mockRestore()
    }

    expect(runtimeEnvironmentTransportCall.mock.calls.map((call) => call[0].method)).toEqual([
      'status.get'
    ])
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
    expect(mockApi.worktrees.listDetected).not.toHaveBeenCalled()
  })

  it('does not coalesce a foreground re-probe onto a background reuse:true scan for a remote repo', async () => {
    // Why: reuse is part of the coalescing key, so a foreground reuse:false scan must re-probe, not reuse a stale background failure.
    const store = createTestStore()
    const remote = makeWorktree({ id: 'repo1::/remote/wt', repoId: 'repo1', path: '/remote/wt' })
    store.setState({
      settings: { activeRuntimeEnvironmentId: 'env-1' } as never,
      hasHydratedWorktreePurge: true,
      repos: [
        completeMakeRepo({
          id: 'repo1',
          path: '/r1',
          displayName: 'R1',
          badgeColor: '#000',
          addedAt: 0,
          executionHostId: 'runtime:env-1' as const
        })
      ]
    })

    let scanStartedCount = 0
    const scanReleases: (() => void)[] = []
    runtimeEnvironmentCall.mockImplementation(({ method }: RuntimeEnvironmentCallRequest) => {
      if (method === 'worktree.detectedList') {
        scanStartedCount += 1
        return new Promise((resolve) => {
          scanReleases.push(() =>
            resolve({
              id: 'rpc',
              ok: true,
              result: makeDetectedResult('repo1', [remote]),
              _meta: { runtimeId: 'runtime-remote' }
            })
          )
        })
      }
      return Promise.resolve({ id: method, ok: true, result: {}, _meta: {} })
    })

    const background = store.getState().fetchAllWorktrees()
    const foreground = store.getState().fetchWorktrees('repo1')
    // Flush microtasks so both compat preflights settle and both scans block.
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(scanStartedCount).toBe(2)

    scanReleases.forEach((release) => release())
    await Promise.all([background, foreground])
    expect(store.getState().worktreesByRepo.repo1?.map((worktree) => worktree.id)).toEqual([
      remote.id
    ])
  })

  it('preserves floating workspace state while purging a real stale worktree', async () => {
    const store = createTestStore()
    const wtA = makeWorktree({ id: 'repoA::/a/wt1', repoId: 'repoA', path: '/a/wt1' })
    const wtB = makeWorktree({ id: 'repoB::/b/wt1', repoId: 'repoB', path: '/b/wt1' })
    const staleId = 'repoA::/a/zombie'
    const floatingFile = {
      id: 'floating-file',
      worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
      filePath: '/floating/note.md',
      relativePath: 'note.md',
      language: 'markdown',
      isDirty: false,
      isPreview: false,
      mode: 'edit' as const
    }

    mockApi.worktrees.list.mockImplementation(async ({ repoId }: { repoId: string }) =>
      repoId === 'repoA' ? [wtA] : [wtB]
    )

    store.setState({
      repos: [repoA, repoB],
      activeWorktreeId: FLOATING_TERMINAL_WORKTREE_ID,
      activeFileId: 'floating-file',
      activeTabId: 'floating-terminal-tab',
      activeTabType: 'editor' as const,
      tabsByWorktree: {
        [wtA.id]: [
          {
            ptyId: null,
            title: 'Terminal',
            customTitle: null,
            color: null,
            sortOrder: 0,
            createdAt: 1,
            id: 'tab-A',
            worktreeId: wtA.id
          }
        ],
        [staleId]: [
          {
            ptyId: null,
            title: 'Terminal',
            customTitle: null,
            color: null,
            sortOrder: 0,
            createdAt: 1,
            id: 'tab-zombie',
            worktreeId: staleId
          }
        ],
        [FLOATING_TERMINAL_WORKTREE_ID]: [
          {
            ptyId: null,
            title: 'Terminal',
            customTitle: null,
            color: null,
            sortOrder: 0,
            createdAt: 1,
            id: 'floating-terminal-tab',
            worktreeId: FLOATING_TERMINAL_WORKTREE_ID
          }
        ]
      },
      browserTabsByWorktree: {
        [FLOATING_TERMINAL_WORKTREE_ID]: [
          {
            worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
            title: 'Browser',
            loading: false,
            faviconUrl: null,
            canGoBack: false,
            canGoForward: false,
            loadError: null,
            createdAt: 1,
            id: 'floating-browser',
            url: 'https://alfred.test'
          }
        ]
      },
      activeBrowserTabIdByWorktree: {
        [FLOATING_TERMINAL_WORKTREE_ID]: 'floating-browser'
      },
      openFiles: [
        floatingFile,
        {
          id: 'stale-file',
          worktreeId: staleId,
          filePath: '/a/zombie/stale.ts',
          relativePath: 'stale.ts',
          language: 'typescript',
          isDirty: false,
          isPreview: false,
          mode: 'edit' as const
        }
      ],
      activeFileIdByWorktree: {
        [FLOATING_TERMINAL_WORKTREE_ID]: 'floating-file',
        [staleId]: 'stale-file'
      },
      unifiedTabsByWorktree: {
        [FLOATING_TERMINAL_WORKTREE_ID]: [
          {
            entityId: 'floating-file',
            groupId: 'floating-group',
            contentType: 'editor',
            label: 'File',
            isPinned: false,
            isPreview: false,
            createdAt: 1,
            sortOrder: 0,
            customLabel: null,
            color: null,
            id: 'floating-unified-tab',

            worktreeId: FLOATING_TERMINAL_WORKTREE_ID
          }
        ],
        [staleId]: [
          {
            entityId: 'floating-file',
            groupId: 'floating-group',
            contentType: 'editor',
            label: 'File',
            isPinned: false,
            isPreview: false,
            createdAt: 1,
            sortOrder: 0,
            customLabel: null,
            color: null,
            id: 'stale-unified-tab',
            worktreeId: staleId
          }
        ]
      },
      groupsByWorktree: {
        [FLOATING_TERMINAL_WORKTREE_ID]: [
          {
            tabOrder: [],
            id: 'floating-group',
            worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
            activeTabId: 'floating-unified-tab'
          }
        ],
        [staleId]: [
          { tabOrder: [], id: 'stale-group', worktreeId: staleId, activeTabId: 'stale-unified-tab' }
        ]
      },
      layoutByWorktree: {
        [FLOATING_TERMINAL_WORKTREE_ID]: { type: 'leaf', groupId: 'floating-group' },
        [staleId]: { type: 'leaf', groupId: 'stale-group' }
      }
    })

    await store.getState().fetchAllWorktrees()

    expect(store.getState().hasHydratedWorktreePurge).toBe(true)
    expect(store.getState().tabsByWorktree).toEqual({
      [wtA.id]: [
        {
          ptyId: null,
          title: 'Terminal',
          customTitle: null,
          color: null,
          sortOrder: 0,
          createdAt: 1,
          id: 'tab-A',
          worktreeId: wtA.id
        }
      ],
      [FLOATING_TERMINAL_WORKTREE_ID]: [
        {
          ptyId: null,
          title: 'Terminal',
          customTitle: null,
          color: null,
          sortOrder: 0,
          createdAt: 1,
          id: 'floating-terminal-tab',
          worktreeId: FLOATING_TERMINAL_WORKTREE_ID
        }
      ]
    })
    expect(store.getState().browserTabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID]).toEqual([
      {
        worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
        title: 'Browser',
        loading: false,
        faviconUrl: null,
        canGoBack: false,
        canGoForward: false,
        loadError: null,
        createdAt: 1,
        id: 'floating-browser',
        url: 'https://alfred.test'
      }
    ])
    expect(store.getState().openFiles).toEqual([floatingFile])
    expect(store.getState().activeFileIdByWorktree[FLOATING_TERMINAL_WORKTREE_ID]).toBe(
      'floating-file'
    )
    expect(store.getState().unifiedTabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID]).toHaveLength(1)
    expect(store.getState().groupsByWorktree[FLOATING_TERMINAL_WORKTREE_ID]).toHaveLength(1)
    expect(store.getState().layoutByWorktree[FLOATING_TERMINAL_WORKTREE_ID]).toEqual({
      type: 'leaf',
      groupId: 'floating-group'
    })
    expect(store.getState().activeWorktreeId).toBe(FLOATING_TERMINAL_WORKTREE_ID)
    expect(store.getState().activeFileId).toBe('floating-file')
    expect(store.getState().activeTabId).toBe('floating-terminal-tab')
    expect(store.getState().activeTabType).toBe('editor')
  })
})
