import { describe, expect, it } from 'vitest'
import { nativeHostEntryPath } from './native-host-shell-destination'
import { mobileWebEntryPath } from './bridge/mobile-web-entry-path'

describe('native host entry', () => {
  it.each([
    ['[hostId]/index', '/h/desktop'],
    ['[hostId]/session/[worktreeId]', '/h/desktop/session/folder%3Atest'],
    ['[hostId]/tasks', '/h/desktop/tasks?worktreeId=folder%3Atest']
  ])('opens %s inside the shell', (name, path) => {
    const params =
      name === '[hostId]/index'
        ? { hostId: 'desktop' }
        : { hostId: 'desktop', worktreeId: 'folder:test' }
    expect(nativeHostEntryPath(name, params)).toBe(path)
  })
  it('preserves new-workspace and notification params', () => {
    expect(
      nativeHostEntryPath('[hostId]/index', { hostId: 'desktop', action: 'new', name: 'A & B' })
    ).toBe('/h/desktop?action=new&name=A+%26+B')
  })
  it('preserves explicit destinations from the previous shell route', () => {
    expect(
      nativeHostEntryPath('[hostId]/web', { hostId: 'desktop', initialPath: '/h/desktop/tasks' })
    ).toBe('/h/desktop/tasks')
  })
  it.each([
    'https://example.com/h/desktop',
    '//example.com/h/desktop',
    '/h/other',
    '/h/desktop?hostId=other',
    '/h/desktop/../other',
    '/h/desktop/web',
    '/h/desktop/edit'
  ])('refuses an out-of-scope destination %s', (path) => {
    expect(mobileWebEntryPath('desktop', path)).toBe('/h/desktop')
  })
})
