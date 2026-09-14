import { createElement, createRef } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import type { RpcResponse } from '../transport/types'

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
  Platform: { OS: 'ios', select: (values: { ios: unknown }) => values.ios },
  StyleSheet: { create: <T,>(styles: T) => styles }
}))
vi.mock(
  'lucide-react-native',
  () =>
    new Proxy(
      {},
      { get: (_target, name) => (typeof name === 'string' ? name : undefined), has: () => true }
    )
)
vi.mock('./BottomDrawer', () => ({ BottomDrawer: 'BottomDrawer' }))
import { AddProjectDrawer } from './AddProjectDrawer'

function success(result: unknown): RpcResponse {
  return { id: 'test', ok: true, result }
}
const directory = { resolvedPath: '/home/dev/projects', entries: [] }
const repo = { id: 'new', displayName: 'project', path: '/home/dev/projects/project', kind: 'git' }
function makeClient(sendRequest: RpcClient['sendRequest']): RpcClient {
  return {
    sendRequest,
    subscribe: () => () => {},
    updateTerminalSubscriptionViewport: () => {},
    getState: () => 'connected',
    getReconnectAttempt: () => 0,
    getLastConnectedAt: () => null,
    onStateChange: () => () => {},
    notifyForeground: () => {},
    close: () => {}
  }
}
function responseFor(method: string): RpcResponse {
  if (method === 'ssh.listTargetSummaries') {
    return success({ targets: [{ id: 'ssh-1', label: 'Build server', connected: false }] })
  }
  if (method === 'repo.gitAvailable') {
    return success({ available: true })
  }
  if (method === 'ssh.connect') {
    return success({ state: { status: 'connected' } })
  }
  if (method === 'files.browseServerDir' || method === 'ssh.browseDir') {
    return success(directory)
  }
  return success({ repo: method.endsWith('Remote') ? { ...repo, connectionId: 'ssh-1' } : repo })
}

describe('AddProjectDrawer', () => {
  let renderer: ReactTestRenderer
  afterEach(() => {
    act(() => renderer?.unmount())
  })
  async function mount(client: RpcClient | null, onAdded = vi.fn()) {
    await act(async () => {
      renderer = create(
        createElement(AddProjectDrawer, {
          visible: true,
          client,
          hostLabel: 'My Mac',
          onAdded,
          onClose: vi.fn()
        })
      )
    })
    return onAdded
  }
  function button(label: string) {
    return renderer.root
      .findAll((node) => node.type === 'Pressable')
      .find(
        (node) =>
          node.props.accessibilityLabel === label ||
          node
            .findAll((child) => child.type === 'Text')
            .some((child) => child.props.children === label)
      )!
  }
  async function press(label: string) {
    await act(async () => {
      button(label).props.onPress()
    })
  }
  function fill(label: string, value: string) {
    act(() => renderer.root.findByProps({ accessibilityLabel: label }).props.onChangeText(value))
  }
  function setupSend() {
    return vi
      .fn<RpcClient['sendRequest']>()
      .mockImplementation(async (method) => responseFor(method))
  }

  it('offers the same three entry methods as desktop', async () => {
    await mount(makeClient(setupSend()))
    expect(button('Browse folder')).toBeDefined()
    expect(button('Clone from URL')).toBeDefined()
    expect(button('Create new project')).toBeDefined()
    expect(button('Select host')).toBeDefined()
  })

  it.each(['git', 'folder'] as const)(
    'adds a %s project using the host-resolved path',
    async (kind) => {
      const send = setupSend()
      send.mockImplementation(async (method) =>
        method === 'repo.add' ? success({ repo: { ...repo, kind } }) : responseFor(method)
      )
      const added = await mount(makeClient(send))
      await press('Browse folder')
      if (kind === 'folder') {
        await press('Folder')
      }
      await press('Add project')
      expect(send).toHaveBeenCalledWith(
        'repo.add',
        { path: directory.resolvedPath, kind },
        { failWhenDisconnected: true, timeoutMs: 60_000 }
      )
      expect(added).toHaveBeenCalledWith(expect.objectContaining({ ...repo, kind }))
    }
  )

  it('clones a GitLab URL into the selected parent with a long request budget', async () => {
    const send = setupSend()
    const added = await mount(makeClient(send))
    await press('Clone from URL')
    fill('Git URL', ' https://gitlab.com/team/project.git ')
    fill('Parent folder', '~/projects')
    await press('Clone')
    expect(send).toHaveBeenCalledWith(
      'repo.clone',
      { url: 'https://gitlab.com/team/project.git', destination: directory.resolvedPath },
      { failWhenDisconnected: true, timeoutMs: 600_000 }
    )
    expect(added).toHaveBeenCalledOnce()
  })

  it('creates an empty Git project and preserves its draft when browsing the parent', async () => {
    const send = setupSend()
    const added = await mount(makeClient(send))
    await press('Create new project')
    fill('Project name', 'new-project')
    await press('Project location')
    await press('Choose parent folder')
    await press('Select folder')
    expect(renderer.root.findByProps({ accessibilityLabel: 'Project name' }).props.value).toBe(
      'new-project'
    )
    await press('Create project')
    expect(send).toHaveBeenCalledWith(
      'repo.create',
      { parentPath: directory.resolvedPath, name: 'new-project', kind: 'git' },
      { failWhenDisconnected: true, timeoutMs: 60_000 }
    )
    expect(added).toHaveBeenCalledOnce()
  })

  it('surfaces a host creation error and permits retry without losing the name', async () => {
    const send = setupSend()
    let attempts = 0
    send.mockImplementation(async (method) =>
      method === 'repo.create' && attempts++ === 0
        ? success({ error: 'Git author identity is not configured' })
        : responseFor(method)
    )
    const added = await mount(makeClient(send))
    await press('Create new project')
    fill('Project name', 'new-project')
    await press('Create project')
    expect(added).not.toHaveBeenCalled()
    expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain(
      'Git author identity'
    )
    await press('Create project')
    expect(added).toHaveBeenCalledOnce()
  })

  it('disables Git creation when the host reports Git unavailable', async () => {
    const send = setupSend()
    send.mockImplementation(async (method) =>
      method === 'repo.gitAvailable' ? success({ available: false }) : responseFor(method)
    )
    await mount(makeClient(send))
    await press('Create new project')
    fill('Project name', 'new-project')
    expect(button('Create project').props.disabled).toBe(true)
  })

  it.each(['add', 'clone', 'create'])(
    'routes %s to the selected SSH host after connecting it',
    async (action) => {
      const send = setupSend()
      const added = await mount(makeClient(send))
      await press('Select host')
      await press('Build server')
      expect(button('Clone from URL').props.disabled).toBe(true)
      await press('Connect host')
      await press(
        action === 'add'
          ? 'Open project on SSH host'
          : action === 'clone'
            ? 'Clone from URL'
            : 'Create new project'
      )
      if (action === 'clone') {
        fill('Git URL', 'git@gitlab.com:team/project.git')
      }
      if (action === 'create') {
        fill('Project name', 'project')
      }
      await press(
        action === 'add' ? 'Add project' : action === 'clone' ? 'Clone' : 'Create project'
      )
      expect(send).toHaveBeenCalledWith(
        `repo.${action}Remote`,
        expect.objectContaining({ connectionId: 'ssh-1' }),
        expect.anything()
      )
      expect(send).not.toHaveBeenCalledWith(`repo.${action}`, expect.anything(), expect.anything())
      expect(added).toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'ssh-1' }))
    }
  )

  it('fails closed when an older host does not expose SSH browsing', async () => {
    const send = setupSend()
    send.mockImplementation(async (method) =>
      method === 'ssh.browseDir'
        ? {
            id: 'test',
            ok: false,
            error: { code: 'METHOD_NOT_FOUND', message: 'Unknown method: ssh.browseDir' }
          }
        : responseFor(method)
    )
    const added = await mount(makeClient(send))
    await press('Select host')
    await press('Build server')
    await press('Connect host')
    await press('Open project on SSH host')
    expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain(
      'Update Orca'
    )
    expect(send).not.toHaveBeenCalledWith(
      'files.browseServerDir',
      expect.anything(),
      expect.anything()
    )
    expect(added).not.toHaveBeenCalled()
  })

  it('browses Windows drive paths with the host path flavor', async () => {
    const send = setupSend()
    send.mockImplementation(async (method) =>
      method === 'files.browseServerDir'
        ? success({
            resolvedPath: 'C:\\',
            pathFlavor: 'win32',
            entries: [{ name: 'Projects', isDirectory: true }]
          })
        : responseFor(method)
    )
    await mount(makeClient(send))
    await press('Browse folder')
    await press('Projects')
    expect(send).toHaveBeenLastCalledWith(
      'files.browseServerDir',
      { path: 'C:\\Projects' },
      undefined
    )
    await press('Parent folder')
    expect(send).toHaveBeenLastCalledWith('files.browseServerDir', { path: '/' }, undefined)
  })

  it('uses system back for nested steps and blocks it during a mutation', async () => {
    let resolve: (reply: RpcResponse) => void = () => {}
    const send = setupSend()
    send.mockImplementation(async (method) =>
      method === 'repo.clone'
        ? new Promise((done) => {
            resolve = done
          })
        : responseFor(method)
    )
    const backHandlerRef = createRef<(() => void) | null>()
    const onClose = vi.fn()
    await act(async () => {
      renderer = create(
        createElement(AddProjectDrawer, {
          visible: true,
          client: makeClient(send),
          onAdded: vi.fn(),
          onClose,
          backHandlerRef
        })
      )
    })
    await press('Clone from URL')
    act(() => backHandlerRef.current?.())
    expect(button('Browse folder')).toBeDefined()
    expect(onClose).not.toHaveBeenCalled()
    await press('Clone from URL')
    fill('Git URL', 'https://gitlab.com/team/project.git')
    await press('Clone')
    act(() => backHandlerRef.current?.())
    expect(button('Clone')).toBeDefined()
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => {
      resolve(success({ repo }))
    })
    act(() => backHandlerRef.current?.())
    act(() => backHandlerRef.current?.())
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('adopts late default settings without overwriting an edited parent folder', async () => {
    const client = makeClient(setupSend())
    const props = { visible: true, client, onAdded: vi.fn(), onClose: vi.fn() }
    await act(async () => {
      renderer = create(createElement(AddProjectDrawer, props))
    })
    await press('Clone from URL')
    await act(async () => {
      renderer.update(createElement(AddProjectDrawer, { ...props, defaultParent: '/projects' }))
    })
    const input = () =>
      renderer.root
        .findAll((node) => node.type === 'TextInput')
        .find((node) => node.props.accessibilityLabel === 'Parent folder')!
    expect(input().props.value).toBe('/projects')
    fill('Parent folder', '/custom')
    await act(async () => {
      renderer.update(createElement(AddProjectDrawer, { ...props, defaultParent: '/new-default' }))
    })
    expect(input().props.value).toBe('/custom')
  })

  it('prevents duplicate mutations and ignores a completed clone after the drawer closes', async () => {
    let resolve: (reply: RpcResponse) => void = () => {}
    const send = setupSend()
    send.mockImplementation(async (method) =>
      method === 'repo.clone'
        ? new Promise((done) => {
            resolve = done
          })
        : responseFor(method)
    )
    const client = makeClient(send)
    const added = await mount(client)
    await press('Clone from URL')
    fill('Git URL', 'https://gitlab.com/team/project.git')
    await act(async () => {
      button('Clone').props.onPress()
      button('Clone').props.onPress()
    })
    expect(send.mock.calls.filter(([method]) => method === 'repo.clone')).toHaveLength(1)
    act(() =>
      renderer.update(
        createElement(AddProjectDrawer, {
          visible: false,
          client,
          onAdded: added,
          onClose: vi.fn()
        })
      )
    )
    await act(async () => {
      resolve(success({ repo }))
    })
    expect(added).not.toHaveBeenCalled()
  })
})
