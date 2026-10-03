import { beforeEach, describe, expect, it, vi } from 'vitest'

import { folderWorkspaceKey } from '../../../../shared/workspace-scope'
import { makeDetectedResult } from './worktrees-detected-listing-fixtures'
import { makeFolderWorkspace, makeLineage, makeWorktree } from './worktrees-slice-test-fixtures'
import {
  createTestStore,
  listKnownForExecutionHostMock,
  mockApi,
  resetRemoteRuntimeMocks,
  resetWorktreeSliceModuleMemory
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
describe('fetchAllWorktrees hydration-time purge (design §4.4)', () => {
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

  it.each([false, true])(
    'hydrates connecting SSH worktrees with hydration purge completed=%s',
    async (hasHydratedWorktreePurge) => {
      const store = createTestStore()
      const sshRepo = {
        id: 'repo-ssh',
        path: '/home/alfred/repo',
        displayName: 'SSH Repo',
        badgeColor: '#000',
        addedAt: 0,
        connectionId: 'ssh-1'
      }
      const queued = makeWorktree({
        id: 'repo-ssh::/home/alfred/queued',
        repoId: 'repo-ssh',
        path: '/home/alfred/queued',
        displayName: 'queued'
      })
      listKnownForExecutionHostMock.mockResolvedValueOnce({
        status: 'complete',
        repoId: sshRepo.id,
        executionHostId: 'ssh:ssh-1',
        result: makeDetectedResult(sshRepo.id, [queued], {
          authoritative: false,
          source: 'metadata-fallback'
        })
      })
      store.setState({
        repos: [sshRepo],
        hasHydratedWorktreePurge,
        sshConnectionStates: new Map([
          [
            'ssh-1',
            {
              targetId: 'ssh-1',
              status: 'connecting',
              error: null,
              reconnectAttempt: 0,
              providerEpoch: null
            }
          ]
        ])
      })

      await store.getState().fetchAllWorktrees()

      expect(store.getState().worktreesByRepo[sshRepo.id]).toEqual([
        { ...queued, hostId: 'ssh:ssh-1' }
      ])
      expect(listKnownForExecutionHostMock).toHaveBeenCalledWith({
        repoId: sshRepo.id,
        executionHostId: 'ssh:ssh-1'
      })
      expect(mockApi.worktrees.listDetected).not.toHaveBeenCalled()
    }
  )

  it('preserves resolved inline legacy lineage when side-map hydration is absent', async () => {
    const store = createTestStore()
    const parent = makeWorktree({
      id: 'repoA::/a/parent',
      instanceId: 'parent-instance',
      repoId: 'repoA',
      path: '/a/parent'
    })
    const child = makeWorktree({
      id: 'repoA::/a/child',
      instanceId: 'child-instance',
      repoId: 'repoA',
      path: '/a/child'
    })
    const lineage = makeLineage({
      worktreeId: child.id,
      worktreeInstanceId: child.instanceId!,
      parentWorktreeId: parent.id,
      parentWorktreeInstanceId: parent.instanceId!
    })
    const resolvedParent = {
      ...parent,
      parentWorktreeId: null,
      childWorktreeIds: [child.id],
      lineage: null,
      workspaceLineage: null
    }
    const resolvedChild = {
      ...child,
      parentWorktreeId: parent.id,
      childWorktreeIds: [],
      lineage,
      workspaceLineage: null
    }
    mockApi.worktrees.listDetected.mockResolvedValueOnce(
      makeDetectedResult('repoA', [resolvedParent, resolvedChild])
    )
    store.setState({
      repos: [repoA],
      hasHydratedWorktreePurge: true,
      worktreeLineageById: {}
    })

    await store.getState().fetchAllWorktrees()

    expect(store.getState().worktreeLineageById).toEqual({})
    expect(store.getState().worktreesByRepo.repoA).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: child.id,
          parentWorktreeId: parent.id,
          lineage,
          workspaceLineage: null
        })
      ])
    )
  })

  it('defers the purge when a sibling repo fetch fails (F1 regression)', async () => {
    const store = createTestStore()
    const wtA = makeWorktree({ id: 'repoA::/a/wt1', repoId: 'repoA', path: '/a/wt1' })
    const wtB = makeWorktree({ id: 'repoB::/b/wt1', repoId: 'repoB', path: '/b/wt1' })

    // repoA succeeds, repoB throws; a stale tabsByWorktree entry must NOT be purged while any repo fetch is degraded.
    mockApi.worktrees.list.mockImplementation(async ({ repoId }: { repoId: string }) => {
      if (repoId === 'repoA') {
        return [wtA]
      }
      throw new Error('git error')
    })

    store.setState({
      repos: [repoA, repoB],
      worktreesByRepo: { repoB: [wtB] },
      tabsByWorktree: {
        'repoA::/a/stale': [
          {
            ptyId: null,
            title: 'Terminal',
            customTitle: null,
            color: null,
            sortOrder: 0,
            createdAt: 1,
            id: 'tab-A-stale',
            worktreeId: 'repoA::/a/stale'
          }
        ],
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
      }
    })

    await store.getState().fetchAllWorktrees()

    expect(store.getState().hasHydratedWorktreePurge).toBe(false)
    expect(store.getState().tabsByWorktree).toEqual({
      'repoA::/a/stale': [
        {
          ptyId: null,
          title: 'Terminal',
          customTitle: null,
          color: null,
          sortOrder: 0,
          createdAt: 1,
          id: 'tab-A-stale',
          worktreeId: 'repoA::/a/stale'
        }
      ],
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

    // After repoB recovers, the deferred purge fires for genuinely stale ids.
    mockApi.worktrees.list.mockImplementation(async ({ repoId }: { repoId: string }) => {
      if (repoId === 'repoA') {
        return [wtA]
      }
      return [wtB]
    })

    await store.getState().fetchAllWorktrees()

    expect(store.getState().hasHydratedWorktreePurge).toBe(true)
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
  })

  it('defers the purge when every repo succeeds but none returns worktrees (empty-sibling safety)', async () => {
    const store = createTestStore()

    // Empty valid-id union (both repos newly-cloned, empty) isn't authoritative — defer instead of wiping tabsByWorktree.
    mockApi.worktrees.list.mockResolvedValue([])

    store.setState({
      repos: [repoA, repoB],
      tabsByWorktree: {
        'repoA::/a/wt1': [
          {
            ptyId: null,
            title: 'Terminal',
            customTitle: null,
            color: null,
            sortOrder: 0,
            createdAt: 1,
            id: 'tab-A',
            worktreeId: 'repoA::/a/wt1'
          }
        ]
      }
    })

    await store.getState().fetchAllWorktrees()

    expect(store.getState().hasHydratedWorktreePurge).toBe(false)
    expect(store.getState().tabsByWorktree).toEqual({
      'repoA::/a/wt1': [
        {
          ptyId: null,
          title: 'Terminal',
          customTitle: null,
          color: null,
          sortOrder: 0,
          createdAt: 1,
          id: 'tab-A',
          worktreeId: 'repoA::/a/wt1'
        }
      ]
    })
  })

  it('fires the purge once when every repo returns successfully with ≥1 worktree', async () => {
    const store = createTestStore()
    const wtA = makeWorktree({ id: 'repoA::/a/wt1', repoId: 'repoA', path: '/a/wt1' })
    const wtB = makeWorktree({ id: 'repoB::/b/wt1', repoId: 'repoB', path: '/b/wt1' })
    const folderWorkspace = makeFolderWorkspace({ id: 'folder-keep' })
    const folderKey = folderWorkspaceKey(folderWorkspace.id)

    mockApi.worktrees.list.mockImplementation(async ({ repoId }: { repoId: string }) =>
      repoId === 'repoA' ? [wtA] : [wtB]
    )

    store.setState({
      repos: [repoA, repoB],
      folderWorkspaces: [folderWorkspace],
      tabsByWorktree: {
        'repoA::/a/wt1': [
          {
            ptyId: null,
            title: 'Terminal',
            customTitle: null,
            color: null,
            sortOrder: 0,
            createdAt: 1,
            id: 'tab-A',
            worktreeId: 'repoA::/a/wt1'
          }
        ],
        'repoA::/a/zombie': [
          {
            ptyId: null,
            title: 'Terminal',
            customTitle: null,
            color: null,
            sortOrder: 0,
            createdAt: 1,
            id: 'tab-zombie',
            worktreeId: 'repoA::/a/zombie'
          }
        ],
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
        ],
        [folderKey]: [
          {
            ptyId: null,
            title: 'Terminal',
            customTitle: null,
            color: null,
            sortOrder: 0,
            createdAt: 1,
            id: 'tab-folder',
            worktreeId: folderKey
          }
        ]
      },
      gitIgnoredPathsByWorktree: {
        'repoA::/a/wt1': ['dist/'],
        'repoA::/a/zombie': ['coverage/'],
        'repoB::/b/wt1': ['build/'],
        [folderKey]: ['tmp/']
      }
    })

    await store.getState().fetchAllWorktrees()

    expect(store.getState().hasHydratedWorktreePurge).toBe(true)
    expect(mockApi.worktrees.list).toHaveBeenCalledTimes(2)
    expect(store.getState().tabsByWorktree).toEqual({
      'repoA::/a/wt1': [
        {
          ptyId: null,
          title: 'Terminal',
          customTitle: null,
          color: null,
          sortOrder: 0,
          createdAt: 1,
          id: 'tab-A',
          worktreeId: 'repoA::/a/wt1'
        }
      ],
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
      ],
      [folderKey]: [
        {
          ptyId: null,
          title: 'Terminal',
          customTitle: null,
          color: null,
          sortOrder: 0,
          createdAt: 1,
          id: 'tab-folder',
          worktreeId: folderKey
        }
      ]
    })
    expect(store.getState().gitIgnoredPathsByWorktree).toEqual({
      'repoA::/a/wt1': ['dist/'],
      'repoB::/b/wt1': ['build/'],
      [folderKey]: ['tmp/']
    })

    // Second call must not re-run the purge even if new stale ids appear.
    store.setState({
      tabsByWorktree: {
        ...store.getState().tabsByWorktree,
        'repoA::/a/new-zombie': [
          {
            ptyId: null,
            title: 'Terminal',
            customTitle: null,
            color: null,
            sortOrder: 0,
            createdAt: 1,
            id: 'tab-new-zombie',
            worktreeId: 'repoA::/a/new-zombie'
          }
        ]
      }
    })

    await store.getState().fetchAllWorktrees()

    expect(mockApi.worktrees.list).toHaveBeenCalledTimes(4)
    expect(store.getState().tabsByWorktree['repoA::/a/new-zombie']).toBeDefined()
  })

  it('can defer the first successful purge during local-only startup refresh', async () => {
    const store = createTestStore()
    const wtA = makeWorktree({ id: 'repoA::/a/wt1', repoId: 'repoA', path: '/a/wt1' })
    const wtB = makeWorktree({ id: 'repoB::/b/wt1', repoId: 'repoB', path: '/b/wt1' })

    mockApi.worktrees.list.mockImplementation(async ({ repoId }: { repoId: string }) =>
      repoId === 'repoA' ? [wtA] : [wtB]
    )

    store.setState({
      repos: [repoA, repoB],
      tabsByWorktree: {
        'repoA::/a/wt1': [
          {
            ptyId: null,
            title: 'Terminal',
            customTitle: null,
            color: null,
            sortOrder: 0,
            createdAt: 1,
            id: 'tab-A',
            worktreeId: 'repoA::/a/wt1'
          }
        ],
        'repoA::/a/zombie': [
          {
            ptyId: null,
            title: 'Terminal',
            customTitle: null,
            color: null,
            sortOrder: 0,
            createdAt: 1,
            id: 'tab-zombie',
            worktreeId: 'repoA::/a/zombie'
          }
        ],
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
      }
    })

    await store.getState().fetchAllWorktrees({ hydrationPurge: 'defer' })

    expect(store.getState().hasHydratedWorktreePurge).toBe(false)
    expect(store.getState().tabsByWorktree['repoA::/a/zombie']).toBeDefined()

    await store.getState().fetchAllWorktrees()

    expect(store.getState().hasHydratedWorktreePurge).toBe(true)
    expect(store.getState().tabsByWorktree).toEqual({
      'repoA::/a/wt1': [
        {
          ptyId: null,
          title: 'Terminal',
          customTitle: null,
          color: null,
          sortOrder: 0,
          createdAt: 1,
          id: 'tab-A',
          worktreeId: 'repoA::/a/wt1'
        }
      ],
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
  })

  it('does not consume the one-shot purge before clean workspace session hydration', async () => {
    const store = createTestStore()
    const wtA = makeWorktree({ id: 'repoA::/a/wt1', repoId: 'repoA', path: '/a/wt1' })
    const wtB = makeWorktree({ id: 'repoB::/b/wt1', repoId: 'repoB', path: '/b/wt1' })

    mockApi.worktrees.list.mockImplementation(async ({ repoId }: { repoId: string }) =>
      repoId === 'repoA' ? [wtA] : [wtB]
    )

    store.setState({
      workspaceSessionReady: false,
      hydrationSucceeded: false,
      repos: [repoA, repoB],
      tabsByWorktree: {
        'repoA::/a/wt1': [
          {
            ptyId: null,
            title: 'Terminal',
            customTitle: null,
            color: null,
            sortOrder: 0,
            createdAt: 1,
            id: 'tab-A',
            worktreeId: 'repoA::/a/wt1'
          }
        ],
        'repoA::/a/zombie': [
          {
            ptyId: null,
            title: 'Terminal',
            customTitle: null,
            color: null,
            sortOrder: 0,
            createdAt: 1,
            id: 'tab-zombie',
            worktreeId: 'repoA::/a/zombie'
          }
        ],
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
      }
    })

    await store.getState().fetchAllWorktrees()

    expect(store.getState().hasHydratedWorktreePurge).toBe(false)
    expect(store.getState().tabsByWorktree['repoA::/a/zombie']).toBeDefined()

    store.setState({ workspaceSessionReady: true })
    await store.getState().fetchAllWorktrees()

    expect(store.getState().hasHydratedWorktreePurge).toBe(false)
    expect(store.getState().tabsByWorktree['repoA::/a/zombie']).toBeDefined()

    store.setState({ hydrationSucceeded: true })
    await store.getState().fetchAllWorktrees()

    expect(store.getState().hasHydratedWorktreePurge).toBe(true)
    expect(store.getState().tabsByWorktree).toEqual({
      'repoA::/a/wt1': [
        {
          ptyId: null,
          title: 'Terminal',
          customTitle: null,
          color: null,
          sortOrder: 0,
          createdAt: 1,
          id: 'tab-A',
          worktreeId: 'repoA::/a/wt1'
        }
      ],
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
  })

  // Why: multi-host regression — after hydration a mid-session fetch must never purge, even if a host reports zero worktrees.
})
