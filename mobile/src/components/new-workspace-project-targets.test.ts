import { describe, expect, it } from 'vitest'
import { getLocalExecutionHostLabel } from '../../../src/shared/execution-host'
import {
  buildNewWorkspaceProjectOptions,
  buildNewWorkspaceRunTargetOptions,
  getNewWorkspaceRunTarget
} from './new-workspace-project-targets'

const LOCAL_HOST_LABEL = getLocalExecutionHostLabel('darwin')

describe('new workspace project targets', () => {
  it('groups local and SSH checkouts of the same project', () => {
    const upstream = { owner: 'GOI17', repo: 'alfred-workspace' }
    const options = buildNewWorkspaceProjectOptions([
      { id: 'local', displayName: 'alfred', path: '/src/alfred', upstream },
      {
        id: 'ssh',
        displayName: 'alfred',
        path: '/home/dev/alfred',
        connectionId: 'build-server',
        upstream
      }
    ])

    expect(options).toHaveLength(1)
    expect(options[0]).toMatchObject({ label: 'alfred', detail: 'GOI17/alfred-workspace' })
  })

  it('shows the provider slug recovered from canonical git identity', () => {
    const options = buildNewWorkspaceProjectOptions([
      {
        id: 'local',
        displayName: 'alfred',
        path: '/src/alfred',
        gitRemoteIdentity: {
          canonicalKey: 'github.com/GOI17/alfred-workspace',
          remoteName: 'origin',
          remoteUrl: 'git@github.com:GOI17/alfred-workspace.git'
        }
      }
    ])

    expect(options[0]).toMatchObject({ label: 'alfred', detail: 'GOI17/alfred-workspace' })
  })

  it('labels local, SSH, and paired runtime targets', () => {
    expect(
      getNewWorkspaceRunTarget(
        { id: 'local', displayName: 'alfred', path: '/src/alfred' },
        'darwin'
      )
    ).toEqual({ label: LOCAL_HOST_LABEL, detail: '/src/alfred' })
    expect(
      getNewWorkspaceRunTarget({ id: 'local', displayName: 'alfred', path: 'C:\\src\\alfred' })
    ).toEqual({ label: 'This computer', detail: 'C:\\src\\alfred' })
    expect(
      getNewWorkspaceRunTarget(
        { id: 'local', displayName: 'alfred', path: 'C:\\src\\alfred' },
        'win32'
      )
    ).toEqual({ label: 'Local Windows', detail: 'C:\\src\\alfred' })
    expect(
      getNewWorkspaceRunTarget({
        id: 'ssh',
        displayName: 'alfred',
        path: 'C:\\src\\alfred',
        executionHostId: 'ssh:Windows%20VM'
      })
    ).toEqual({ label: 'SSH · Windows VM', detail: 'C:\\src\\alfred' })
    expect(
      getNewWorkspaceRunTarget({
        id: 'runtime',
        displayName: 'alfred',
        path: '/src/alfred',
        executionHostId: 'runtime:devbox'
      })
    ).toEqual({ label: 'Remote · devbox', detail: '/src/alfred' })
  })

  it('shows one target per host when the project has multiple local worktrees', () => {
    const upstream = { owner: 'GOI17', repo: 'alfred-workspace' }
    const repos = [
      { id: 'local-a', displayName: 'alfred-a', path: '/src/alfred-a', upstream },
      { id: 'local-b', displayName: 'alfred-b', path: '/src/alfred-b', upstream },
      {
        id: 'ssh',
        displayName: 'alfred',
        path: '/home/dev/alfred',
        connectionId: 'build-server',
        upstream
      }
    ]
    const projectId = buildNewWorkspaceProjectOptions(repos)[0]?.id ?? null

    expect(buildNewWorkspaceRunTargetOptions(repos, projectId, 'darwin')).toEqual([
      expect.objectContaining({ id: 'local-a', label: LOCAL_HOST_LABEL, detail: '/src/alfred-a' }),
      expect.objectContaining({
        id: 'ssh',
        label: 'SSH · build-server',
        detail: '/home/dev/alfred'
      })
    ])
  })
})
