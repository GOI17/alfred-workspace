import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RpcDispatcher } from '../dispatcher'
import { OrcaRuntimeService } from '../../orca-runtime'
import { REMOTE_REPO_METHODS } from './remote-repo'
import { SSH_METHODS } from './ssh'

const ssh = vi.hoisted(() => ({ getConnection: vi.fn(), browse: vi.fn() }))
vi.mock('../../../ssh/ssh-target-registry', () => ({
  getSshConnectionManager: () => ({ getConnection: ssh.getConnection })
}))
vi.mock('../../../ssh/ssh-directory-browse', () => ({ browseSshDirectory: ssh.browse }))

const repo = {
  id: 'remote-project',
  path: '/srv/project',
  kind: 'git',
  connectionId: 'ssh-1',
  executionHostId: 'ssh:ssh-1'
}
function setup() {
  const runtime = {
    getRuntimeId: () => 'runtime',
    getClientSettings: () => ({}),
    addRemoteRepo: vi.fn().mockResolvedValue(repo),
    createRemoteRepo: vi.fn().mockResolvedValue({ repo }),
    cloneRemoteRepo: vi.fn().mockResolvedValue(repo),
    addRepo: vi.fn(),
    createRepo: vi.fn(),
    cloneRepo: vi.fn()
  }
  const dispatcher = new RpcDispatcher({
    runtime: Object.assign(new OrcaRuntimeService(), runtime),
    methods: [...REMOTE_REPO_METHODS, ...SSH_METHODS]
  })
  const dispatch = (method: string, params: unknown) =>
    dispatcher.dispatch({ id: 'request', authToken: 'token', method, params })
  return { runtime, dispatch }
}

describe('remote project RPC routing', () => {
  beforeEach(() => vi.resetAllMocks())

  it('preserves the execution host for adding, cloning and creating projects', async () => {
    const { runtime, dispatch } = setup()
    expect(
      await dispatch('repo.addRemote', {
        connectionId: 'ssh-1',
        path: '/srv/folder',
        kind: 'folder',
        displayName: 'Notes'
      })
    ).toMatchObject({ ok: true, result: { repo } })
    expect(runtime.addRemoteRepo).toHaveBeenCalledWith({
      connectionId: 'ssh-1',
      remotePath: '/srv/folder',
      kind: 'folder',
      displayName: 'Notes'
    })
    expect(
      await dispatch('repo.cloneRemote', {
        connectionId: 'ssh-1',
        url: 'https://gitlab.com/team/project.git',
        destination: '/srv'
      })
    ).toMatchObject({ ok: true, result: { repo } })
    expect(runtime.cloneRemoteRepo).toHaveBeenCalledWith({
      connectionId: 'ssh-1',
      url: 'https://gitlab.com/team/project.git',
      destination: '/srv'
    })
    expect(
      await dispatch('repo.createRemote', {
        connectionId: 'ssh-1',
        parentPath: '/srv',
        name: 'project'
      })
    ).toMatchObject({ ok: true, result: { repo } })
    expect(runtime.createRemoteRepo).toHaveBeenCalledWith({
      connectionId: 'ssh-1',
      parentPath: '/srv',
      name: 'project',
      kind: 'git'
    })
    expect(runtime.addRepo).not.toHaveBeenCalled()
    expect(runtime.cloneRepo).not.toHaveBeenCalled()
    expect(runtime.createRepo).not.toHaveBeenCalled()
  })

  it.each([
    ['repo.addRemote', { path: '/srv/project' }],
    ['repo.cloneRemote', { url: 'https://gitlab.com/team/project.git', destination: '/srv' }],
    ['repo.createRemote', { parentPath: '/srv', name: 'project' }]
  ])('rejects %s without an explicit host', async (method, params) => {
    const { runtime, dispatch } = setup()
    expect(await dispatch(method, params)).toMatchObject({ ok: false })
    expect(runtime.addRemoteRepo).not.toHaveBeenCalled()
    expect(runtime.cloneRemoteRepo).not.toHaveBeenCalled()
    expect(runtime.createRemoteRepo).not.toHaveBeenCalled()
  })

  it('preserves creation errors and never retries failed remote work locally', async () => {
    const { runtime, dispatch } = setup()
    runtime.createRemoteRepo.mockResolvedValueOnce({ error: 'Directory is not empty' })
    runtime.addRemoteRepo.mockRejectedValueOnce(new Error('SSH host is not connected'))
    expect(
      await dispatch('repo.createRemote', {
        connectionId: 'ssh-1',
        parentPath: '/srv',
        name: 'project'
      })
    ).toMatchObject({ ok: true, result: { error: 'Directory is not empty' } })
    expect(
      await dispatch('repo.addRemote', {
        connectionId: 'ssh-1',
        path: '/srv/project'
      })
    ).toMatchObject({ ok: false, error: { message: 'SSH host is not connected' } })
    expect(runtime.createRepo).not.toHaveBeenCalled()
    expect(runtime.addRepo).not.toHaveBeenCalled()
  })

  it('browses unregistered folders through the selected SSH connection', async () => {
    const connection = { id: 'ssh-1' }
    ssh.getConnection.mockReturnValue(connection)
    const directory = { resolvedPath: 'C:\\Projects', pathFlavor: 'win32', entries: [] }
    ssh.browse.mockResolvedValue(directory)
    const { dispatch } = setup()
    expect(
      await dispatch('ssh.browseDir', {
        targetId: 'ssh-1',
        dirPath: 'C:\\Projects'
      })
    ).toMatchObject({ ok: true, result: directory })
    expect(ssh.getConnection).toHaveBeenCalledWith('ssh-1')
    expect(ssh.browse).toHaveBeenCalledWith(connection, 'C:\\Projects')
  })

  it('refuses to browse when the SSH connection is absent', async () => {
    ssh.getConnection.mockReturnValue(undefined)
    const { dispatch } = setup()
    expect(
      await dispatch('ssh.browseDir', {
        targetId: 'ssh-1',
        dirPath: '~'
      })
    ).toMatchObject({ ok: false, error: { message: 'SSH host is not connected' } })
    expect(ssh.browse).not.toHaveBeenCalled()
  })
})
