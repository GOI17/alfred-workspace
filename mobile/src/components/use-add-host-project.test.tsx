import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RpcResponse } from '../transport/types'
import { useAddHostProject } from './use-add-host-project'

const listing = { resolvedPath: '/host/project', pathFlavor: 'posix', entries: [] }
const repo = { id: 'added', displayName: 'project', path: '/host/project', kind: 'folder' }
const ok = (result: unknown): RpcResponse => ({
  id: 'test',
  ok: true,
  result,
  _meta: { runtimeId: 'host' }
})
const onAdded = vi.fn()
let renderer: ReactTestRenderer
let current: ReturnType<typeof useAddHostProject> | undefined
function form() {
  if (!current) {
    throw new Error('Not mounted')
  }
  return current
}
function Harness({
  client,
  visible = true
}: {
  client: Parameters<typeof useAddHostProject>[0]
  visible?: boolean
}) {
  current = useAddHostProject(client, visible, onAdded)
  return null
}
afterEach(() => {
  act(() => renderer?.unmount())
  onAdded.mockClear()
  current = undefined
})

async function mount(client: Parameters<typeof useAddHostProject>[0]) {
  await act(async () => {
    renderer = create(createElement(Harness, { client }))
  })
}

describe('adding a project on the paired host', () => {
  it('uses the host-resolved path and chosen kind, and prevents double submit', async () => {
    let finish: (reply: RpcResponse) => void = () => {}
    const sendRequest = vi.fn((method: string) =>
      method === 'repo.add'
        ? new Promise<RpcResponse>((resolve) => {
            finish = resolve
          })
        : Promise.resolve(ok(listing))
    )
    await mount({ sendRequest })
    act(() => form().setKind('folder'))
    let submitted: Promise<void> | undefined
    act(() => {
      submitted = form().add()
      void form().add()
    })
    expect(sendRequest).toHaveBeenCalledWith(
      'repo.add',
      { path: '/host/project', kind: 'folder' },
      { failWhenDisconnected: true }
    )
    expect(sendRequest.mock.calls.filter(([method]) => method === 'repo.add')).toHaveLength(1)
    await act(async () => {
      finish(ok({ repo }))
      await submitted
    })
    expect(onAdded).toHaveBeenCalledWith(repo)
  })

  it('requires browsing an edited path before adding, including Windows paths', async () => {
    const sendRequest = vi
      .fn()
      .mockResolvedValue(
        ok({ ...listing, resolvedPath: 'C:\\Projects\\Alfred', pathFlavor: 'win32' })
      )
    await mount({ sendRequest })
    act(() => form().setPath('C:\\Different'))
    await act(async () => {
      await form().add()
    })
    expect(sendRequest).toHaveBeenCalledTimes(1)
    act(() => form().setPath('C:\\Projects\\Alfred'))
    sendRequest.mockResolvedValueOnce(
      ok({ repo: { ...repo, path: 'C:\\Projects\\Alfred', kind: 'git' } })
    )
    await act(async () => {
      await form().add()
    })
    expect(sendRequest).toHaveBeenLastCalledWith(
      'repo.add',
      { path: 'C:\\Projects\\Alfred', kind: 'git' },
      { failWhenDisconnected: true }
    )
  })

  it.each(['forbidden', 'method_not_found'])(
    'explains an older host refusal (%s) without treating it as success',
    async (code) => {
      const sendRequest = vi
        .fn()
        .mockResolvedValueOnce(ok(listing))
        .mockResolvedValue({ id: 'test', ok: false, error: { code, message: 'Unsupported' } })
      await mount({ sendRequest })
      await act(async () => {
        await form().add()
      })
      expect(form().error).toContain('Update desktop')
      expect(onAdded).not.toHaveBeenCalled()
    }
  )

  it('keeps invalid folders and malformed mutation replies recoverable', async () => {
    const sendRequest = vi
      .fn()
      .mockResolvedValueOnce(ok(listing))
      .mockRejectedValueOnce(new Error('Not a valid git repository'))
    await mount({ sendRequest })
    await act(async () => {
      await form().add()
    })
    expect(form().error).toBe('Not a valid git repository')
    sendRequest.mockResolvedValueOnce(ok({ repo: {} }))
    await act(async () => {
      await form().add()
    })
    expect(form().error).toContain('reply this app could not read')
    expect(form().busy).toBe(false)
    expect(onAdded).not.toHaveBeenCalled()
  })

  it('ignores an old host browse reply after the client changes', async () => {
    let finish: (reply: RpcResponse) => void = () => {}
    const old = {
      sendRequest: vi.fn(
        () =>
          new Promise<RpcResponse>((resolve) => {
            finish = resolve
          })
      )
    }
    await mount(old)
    const next = {
      sendRequest: vi.fn().mockResolvedValue(ok({ ...listing, resolvedPath: '/next' }))
    }
    await act(async () => {
      renderer.update(createElement(Harness, { client: next }))
    })
    await act(async () => {
      finish(ok(listing))
    })
    expect(form().directory?.resolvedPath).toBe('/next')
  })

  it('does not reopen or select a project when its pending add completes after dismissal', async () => {
    let finish: (reply: RpcResponse) => void = () => {}
    const client = {
      sendRequest: vi.fn((method: string) =>
        method === 'repo.add'
          ? new Promise<RpcResponse>((resolve) => {
              finish = resolve
            })
          : Promise.resolve(ok(listing))
      )
    }
    await mount(client)
    let submitted: Promise<void> | undefined
    act(() => {
      submitted = form().add()
    })
    await act(async () => {
      renderer.update(createElement(Harness, { client, visible: false }))
    })
    await act(async () => {
      finish(ok({ repo }))
      await submitted
    })
    expect(onAdded).not.toHaveBeenCalled()
  })
})
