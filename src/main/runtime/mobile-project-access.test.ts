import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { OrcaRuntimeRpcServer } from './runtime-rpc'
import { DeviceRegistry } from './device-registry'
import { createMobileRpcSurfaceRuntime } from './runtime-rpc-mobile-method-allowlist-fixtures'

describe('project registration from a paired mobile client', () => {
  it('requires authentication and permits repo.add without enabling deletion or cloning', async () => {
    const userDataPath = mkdtempSync(join(tmpdir(), 'orca-project-access-'))
    try {
      const { runtime } = createMobileRpcSurfaceRuntime()
      const addRepo = vi
        .fn()
        .mockResolvedValue({ id: 'project', path: '/host/project', kind: 'folder' })
      Object.assign(runtime, { addRepo })
      const server = new OrcaRuntimeRpcServer({ runtime, userDataPath, enableWebSocket: false })
      server['deviceRegistry'] = new DeviceRegistry(userDataPath)
      const mobile = server['deviceRegistry'].addDevice('browser', 'mobile')
      const dispatch = async (method: string, token?: string) => {
        const replies: unknown[] = []
        await server['handleWebSocketMessage'](
          JSON.stringify({
            id: 'request',
            method,
            deviceToken: token,
            params: { path: '/host/project', kind: 'folder' }
          }),
          (response) => {
            replies.push(JSON.parse(response))
          },
          () => {}
        )
        return replies[0]
      }
      expect(await dispatch('repo.add', 'invalid')).toMatchObject({
        ok: false,
        error: { code: 'unauthorized' }
      })
      expect(addRepo).not.toHaveBeenCalled()
      expect(await dispatch('repo.add', mobile.token)).toMatchObject({
        ok: true,
        result: { repo: { id: 'project' } }
      })
      expect(addRepo).toHaveBeenCalledWith('/host/project', 'folder', undefined, undefined)
      for (const method of ['repo.remove', 'repo.clone', 'files.delete']) {
        expect(await dispatch(method, mobile.token)).toMatchObject({
          ok: false,
          error: { code: 'forbidden' }
        })
      }
    } finally {
      rmSync(userDataPath, { recursive: true, force: true })
    }
  })
})
