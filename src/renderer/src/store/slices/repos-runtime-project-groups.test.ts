import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from '../../runtime/runtime-compatibility-test-fixture'
import { clearRuntimeCompatibilityCacheForTests } from '../../runtime/runtime-rpc-client'
import { createTestStore } from './store-test-helpers'

const runtimeEnvironmentCall = vi.fn()
const runtimeEnvironmentTransportCall = vi.fn()

beforeEach(() => {
  clearRuntimeCompatibilityCacheForTests()
  runtimeEnvironmentCall.mockReset()
  runtimeEnvironmentTransportCall.mockReset()
  runtimeEnvironmentTransportCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
    return createCompatibleRuntimeStatusResponseIfNeeded(args) ?? runtimeEnvironmentCall(args)
  })
  vi.stubGlobal('window', {
    api: {
      runtimeEnvironments: { call: runtimeEnvironmentTransportCall }
    }
  })
})

describe('repo slice runtime project groups', () => {
  it('keeps runtime copies of a grouped canonical project in the same project group', async () => {
    const gitRemoteIdentity = {
      canonicalKey: 'github.com/GOI17/alfred-workspace',
      remoteName: 'origin',
      remoteUrl: 'https://github.com/GOI17/alfred-workspace.git'
    }
    const localAlfred: Repo = {
      id: 'local-alfred',
      path: '/Users/alice/stably/alfred',
      displayName: 'alfred',
      badgeColor: '#000',
      addedAt: 1,
      executionHostId: 'local',
      gitRemoteIdentity,
      projectGroupId: 'group-alfred'
    }
    const runtimeAlfred: Repo = {
      id: 'runtime-alfred',
      path: '/vercel/sandbox/alfred',
      displayName: 'alfred',
      badgeColor: '#111',
      addedAt: 2,
      gitRemoteIdentity
    }
    runtimeEnvironmentCall.mockResolvedValue({
      id: 'rpc-runtime-alfred',
      ok: true,
      result: { repos: [runtimeAlfred] },
      _meta: { runtimeId: 'runtime-remote' }
    })
    const store = createTestStore()
    store.setState({
      settings: { activeRuntimeEnvironmentId: 'env-1' } as never,
      repos: [localAlfred]
    })

    await store.getState().fetchRepos()

    expect(store.getState().repos).toEqual([
      localAlfred,
      {
        ...runtimeAlfred,
        executionHostId: 'runtime:env-1',
        projectGroupId: 'group-alfred'
      }
    ])
  })
})
