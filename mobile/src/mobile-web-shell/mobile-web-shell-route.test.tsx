import type { ReactNode } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const params: { hostId: string; initialPath?: string } = { hostId: 'host-1' }
  return {
    catalog: vi.fn(),
    params,
    replace: vi.fn()
  }
})
vi.mock('../transport/host-store', () => ({ loadHostCatalog: mocks.catalog }))
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
  StyleSheet: { create: (styles: unknown) => styles }
}))
vi.mock('expo-router', () => ({
  Redirect: 'Redirect',
  router: { replace: mocks.replace },
  useLocalSearchParams: () => mocks.params
}))
vi.mock('../components/HostProtocolGate', () => ({
  HostProtocolGate: ({ children }: { children: ReactNode }) => children
}))
vi.mock('./MobileWebShellScreen', () => ({ MobileWebShellScreen: 'Shell' }))
import MobileWebShellRoute from '../../app/h/[hostId]/web'

async function mount(props?: { routeName?: string; routeParams?: object }) {
  let tree!: ReactTestRenderer
  await act(async () => {
    tree = create(<MobileWebShellRoute {...props} />)
  })
  return tree
}
function nodes(tree: ReactTestRenderer, name: string) {
  return tree.root.findAll((node) => String(node.type) === name)
}

describe('default host interface', () => {
  beforeEach(() => {
    Object.assign(globalThis, { __DEV__: false })
    vi.stubEnv('EXPO_PUBLIC_ORCA_HOST_UI_PREVIEW', '')
    mocks.params.initialPath = undefined
    mocks.replace.mockReset()
    mocks.catalog
      .mockReset()
      .mockResolvedValue([{ id: 'host-1', name: 'Desktop', credentialStatus: 'ready' }])
  })
  it('opens a paired host in a release build without a preview opt-in', async () => {
    const tree = await mount()
    expect(nodes(tree, 'Shell')[0]?.props).toMatchObject({
      hostId: 'host-1',
      hostName: 'Desktop',
      initialPath: '/h/host-1'
    })
  })
  it('preserves a session destination inside the selected host', async () => {
    mocks.params.initialPath = '/h/host-1/session/folder%3Atest?name=Project'
    const tree = await mount()
    expect(nodes(tree, 'Shell')[0]?.props.initialPath).toBe(mocks.params.initialPath)
  })
  it('uses the native screen params before the child route context mounts', async () => {
    const tree = await mount({
      routeName: '[hostId]/session/[worktreeId]',
      routeParams: { hostId: 'host-1', worktreeId: 'folder:test', name: 'Workspace' }
    })
    expect(nodes(tree, 'Shell')[0]?.props.initialPath).toBe(
      '/h/host-1/session/folder%3Atest?name=Workspace'
    )
  })
  it('does not open another host through a deep link', async () => {
    mocks.params.initialPath = '/h/other/session/secret'
    expect(nodes(await mount(), 'Shell')[0]?.props.initialPath).toBe('/h/host-1')
  })
  it.each([{ catalog: [] }, { catalog: [{ id: 'host-1', credentialStatus: 'missing' }] }])(
    'returns unpaired profiles to pairing: %j',
    async ({ catalog }) => {
      mocks.catalog.mockResolvedValue(catalog)
      expect(nodes(await mount(), 'Redirect')[0]?.props.href).toBe('/pair-scan')
    }
  )
  it('can retry a temporarily locked keychain without deleting pairing', async () => {
    mocks.catalog.mockResolvedValue([{ id: 'host-1', credentialStatus: 'temporarily-unavailable' }])
    const tree = await mount()
    expect(nodes(tree, 'Shell')).toHaveLength(0)
    expect(JSON.stringify(tree.toJSON())).toContain('Unlock your device')
    mocks.catalog.mockResolvedValue([{ id: 'host-1', name: 'Desktop', credentialStatus: 'ready' }])
    await act(async () => nodes(tree, 'Pressable')[1]?.props.onPress())
    expect(nodes(tree, 'Shell')).toHaveLength(1)
  })
  it('keeps the host selector available when storage fails', async () => {
    mocks.catalog.mockRejectedValue(new Error('storage'))
    const tree = await mount()
    await act(async () => nodes(tree, 'Pressable')[0]?.props.onPress())
    expect(mocks.replace).toHaveBeenCalledWith('/')
    expect(nodes(tree, 'Shell')).toHaveLength(0)
  })
})
