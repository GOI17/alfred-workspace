import type { RpcClient, SendRequestOptions } from '../transport/rpc-client'
import type { RpcMethodName, RpcParams } from '../transport/rpc-params-contract'
import { requireRpcResultOrThrowCodedError } from '../transport/rpc-acceptance-policies'
import { z } from 'zod'
import { sanitizeRepoIcon } from '../../../src/shared/repo-icon'
import { normalizeExecutionHostId } from '../../../src/shared/execution-host'

export const workspaceProjectSchema = z.object({
  id: z.string().min(1),
  displayName: z.string(),
  path: z.string(),
  kind: z.enum(['git', 'folder']).optional(),
  badgeColor: z.string().optional(),
  repoIcon: z.unknown().transform(sanitizeRepoIcon).optional(),
  connectionId: z.string().nullable().optional(),
  executionHostId: z.string().nullable().optional().transform(normalizeExecutionHostId),
  upstream: z
    .object({ owner: z.string(), repo: z.string(), host: z.string().optional() })
    .nullable()
    .optional(),
  gitRemoteIdentity: z
    .object({ canonicalKey: z.string(), remoteName: z.string(), remoteUrl: z.string() })
    .nullable()
    .optional()
})
export const projectResultSchema = z.object({ repo: workspaceProjectSchema })
export const directoryResultSchema = z.object({
  resolvedPath: z.string(),
  pathFlavor: z.enum(['posix', 'win32']).optional(),
  entries: z.array(
    z.object({ name: z.string(), isDirectory: z.boolean(), isSymlink: z.boolean().optional() })
  )
})

const creationResultSchema = z.union([projectResultSchema, z.object({ error: z.string() })])
const hostsResultSchema = z.object({
  targets: z.array(z.object({ id: z.string(), label: z.string(), connected: z.boolean() }))
})

export const browseProjectDirectory = {
  method: 'files.browseServerDir',
  schema: directoryResultSchema
} as const

export const browseRemoteProjectDirectory = {
  method: 'ssh.browseDir',
  schema: directoryResultSchema
} as const

export const addWorkspaceProject = { method: 'repo.add', schema: projectResultSchema } as const

export const addRemoteWorkspaceProject = {
  method: 'repo.addRemote',
  schema: projectResultSchema
} as const

export const cloneWorkspaceProject = { method: 'repo.clone', schema: projectResultSchema } as const

export const cloneRemoteWorkspaceProject = {
  method: 'repo.cloneRemote',
  schema: projectResultSchema
} as const

export const createWorkspaceProject = {
  method: 'repo.create',
  schema: creationResultSchema
} as const

export const createRemoteWorkspaceProject = {
  method: 'repo.createRemote',
  schema: creationResultSchema
} as const

export const projectGitAvailability = {
  method: 'repo.gitAvailable',
  schema: z.object({ available: z.boolean() })
} as const

export const projectSshHosts = {
  method: 'ssh.listTargetSummaries',
  schema: hostsResultSchema
} as const

export const connectProjectSshHost = {
  method: 'ssh.connect',
  schema: z.object({ state: z.object({ status: z.string() }) })
} as const

export async function requestProjectResult<M extends RpcMethodName, S extends z.ZodType>(
  client: RpcClient,
  operation: { method: M; schema: S },
  params: RpcParams<M>,
  options?: SendRequestOptions
): Promise<z.output<S>> {
  const response = await client.sendRequest(operation.method, params, options)
  return operation.schema.parse(requireRpcResultOrThrowCodedError(response))
}

export function addProjectOnHost(
  client: RpcClient,
  input: {
    action: 'clone' | 'create' | 'browse'
    connectionId?: string
    folderPath: string
    url: string
    name: string
    kind: 'git' | 'folder'
  }
) {
  const { connectionId, folderPath, url, name, kind } = input
  const clone = input.action === 'clone'
  const create = input.action === 'create'
  const options = { failWhenDisconnected: true, timeoutMs: clone ? 10 * 60_000 : 60_000 }
  return clone
    ? connectionId
      ? requestProjectResult(
          client,
          cloneRemoteWorkspaceProject,
          { connectionId, url, destination: folderPath },
          options
        )
      : requestProjectResult(
          client,
          cloneWorkspaceProject,
          { url, destination: folderPath },
          options
        )
    : create
      ? connectionId
        ? requestProjectResult(
            client,
            createRemoteWorkspaceProject,
            { connectionId, parentPath: folderPath, name, kind: 'git' },
            options
          )
        : requestProjectResult(
            client,
            createWorkspaceProject,
            { parentPath: folderPath, name, kind: 'git' },
            options
          )
      : connectionId
        ? requestProjectResult(
            client,
            addRemoteWorkspaceProject,
            { connectionId, path: folderPath, kind },
            options
          )
        : requestProjectResult(client, addWorkspaceProject, { path: folderPath, kind }, options)
}
