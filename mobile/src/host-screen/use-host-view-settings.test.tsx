import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import type { WorkspaceViewSettings } from '../worktree/workspace-view-settings'
import { useHostScreenState } from './use-host-screen-state'
import { useHostViewSettings } from './use-host-view-settings'

async function mountSettings(ui: WorkspaceViewSettings) {
  const sendRequest = vi.fn(async () => ({
    id: 'request-1',
    ok: true as const,
    result: { ui },
    _meta: { runtimeId: 'host-1' }
  }))
  const client: RpcClient = {
    sendRequest,
    subscribe: () => () => {},
    updateTerminalSubscriptionViewport: vi.fn(),
    getState: () => 'connected',
    getReconnectAttempt: () => 0,
    getLastConnectedAt: () => null,
    onStateChange: () => () => {},
    notifyForeground: vi.fn(),
    close: vi.fn()
  }
  let current:
    | {
        state: ReturnType<typeof useHostScreenState>
        settings: ReturnType<typeof useHostViewSettings>
      }
    | undefined
  function Probe() {
    const state = useHostScreenState('host-1', undefined)
    state.clientRef.current = client
    const settings = useHostViewSettings({
      client,
      connState: 'connected',
      hostId: 'host-1',
      state
    })
    current = { state, settings }
    return null
  }
  let renderer: ReactTestRenderer | undefined
  await act(async () => {
    renderer = create(createElement(Probe))
  })
  return {
    get current() {
      if (!current) {
        throw new Error('Settings did not mount')
      }
      return current
    },
    sendRequest,
    unmount: () => act(() => renderer?.unmount())
  }
}

describe('mobile host view settings', () => {
  it.each(['name', 'recent', 'repo', 'manual', 'smart'] as const)(
    'keeps activity ordering and no grouping when the desktop uses %s',
    async (sortBy) => {
      const probe = await mountSettings({
        sortBy,
        groupBy: 'repo',
        hideSleepingWorkspaces: true,
        filterRepoIds: ['repo-2']
      })
      try {
        expect(probe.current.state.sortMode).toBe('smart')
        expect(probe.current.state.groupMode).toBe('none')
        await act(async () => probe.current.settings.syncViewSettingsFromDesktop())
        expect(probe.current.state.sortMode).toBe('smart')
        expect(probe.current.state.groupMode).toBe('none')
        expect(probe.current.state.filters.hideSleeping).toBe(true)
        expect([...probe.current.state.filters.filterRepoIds]).toEqual(['repo-2'])
        expect(probe.current.state.viewStateRef.current).toMatchObject({
          sortMode: 'smart',
          groupMode: 'none'
        })
        await act(async () => probe.current.settings.clearFilters())
        expect(probe.sendRequest).toHaveBeenLastCalledWith('ui.set', {
          hideSleepingWorkspaces: false,
          hideDefaultBranchWorkspace: false,
          filterRepoIds: []
        })
        expect(probe.current.settings.activeFilterCount).toBe(0)
      } finally {
        probe.unmount()
      }
    }
  )
})
