import { createElement, type ReactNode } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  name: '[hostId]/index',
  params: { hostId: 'desktop', worktreeId: 'folder:test' }
}))
vi.mock('expo-router', () => ({
  Stack: ({
    screenLayout
  }: {
    screenLayout: (args: { children: ReactNode; route: typeof state }) => ReactNode
  }) => screenLayout({ route: state, children: createElement('LegacyScreen') })
}))
vi.mock('../../app/h/[hostId]/web', () => ({ default: 'HostInterface' }))
import HostGroupLayout from '../../app/h/_layout'

beforeEach(() => {
  state.name = '[hostId]/index'
})
it.each([
  '[hostId]/index',
  '[hostId]/session/[worktreeId]',
  '[hostId]/files/[worktreeId]',
  '[hostId]/web'
])('renders %s as a host interface without mounting the legacy work screen', (name) => {
  state.name = name
  let tree!: ReactTestRenderer
  act(() => {
    tree = create(createElement(HostGroupLayout))
  })
  expect(tree.toJSON()).toMatchObject({
    type: 'HostInterface',
    props: { routeName: name, routeParams: state.params }
  })
})
it('keeps endpoint and pairing edits in native', () => {
  state.name = '[hostId]/edit'
  let tree: ReturnType<typeof create> | undefined
  act(() => {
    tree = create(createElement(HostGroupLayout))
  })
  expect(tree?.toJSON()).toMatchObject({ type: 'LegacyScreen' })
})
