import { defineMethod } from '../core'
import {
  projectRepoVisibilityForClient,
  projectRepoResultVisibilityForClient
} from '../repo-visibility-projection'
import {
  RemoteRepoPath,
  RemoteRepoCreate,
  RemoteRepoClone
} from '../../../../shared/rpc-contract/repo-params'

export const REMOTE_REPO_METHODS = [
  defineMethod({
    name: 'repo.addRemote',
    params: RemoteRepoPath,
    handler: async (params, context) => ({
      repo: projectRepoVisibilityForClient(
        await context.runtime.addRemoteRepo({
          connectionId: params.connectionId,
          remotePath: params.path,
          kind: params.kind,
          displayName: params.displayName
        }),
        context
      )
    })
  }),
  defineMethod({
    name: 'repo.createRemote',
    params: RemoteRepoCreate,
    handler: async (params, context) =>
      projectRepoResultVisibilityForClient(
        await context.runtime.createRemoteRepo({ ...params, kind: params.kind ?? 'git' }),
        context
      )
  }),
  defineMethod({
    name: 'repo.cloneRemote',
    params: RemoteRepoClone,
    handler: async (params, context) => ({
      repo: projectRepoVisibilityForClient(await context.runtime.cloneRemoteRepo(params), context)
    })
  })
]
