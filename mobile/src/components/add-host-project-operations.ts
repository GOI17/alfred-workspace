import { z } from 'zod'
import { bindDeferredRpcOperation, defineRpcOperation } from '../transport/rpc-operation'
import { rpcResultVariant } from '../transport/rpc-operation-result-reader'

export const hostDirectorySchema = z.object({
  resolvedPath: z.string().min(1),
  pathFlavor: z.enum(['posix', 'win32']).optional(),
  entries: z.array(
    z.object({ name: z.string(), isDirectory: z.boolean(), isSymlink: z.boolean().optional() })
  )
})

export type HostDirectory = z.infer<typeof hostDirectorySchema>

export const browseHostDirectory = bindDeferredRpcOperation(
  defineRpcOperation({
    name: 'files.add-project-directory',
    method: 'files.browseServerDir',
    acceptance: 'require-result-or-throw-message',
    barrier: 'after-caller-barrier',
    read: rpcResultVariant('host-directory', hostDirectorySchema)
  })
)

export const addHostProject = bindDeferredRpcOperation(
  defineRpcOperation({
    name: 'repo.add-host-project',
    method: 'repo.add',
    acceptance: 'require-result-or-throw-message',
    barrier: 'after-caller-barrier',
    read: rpcResultVariant(
      'added-project',
      z
        .object({
          repo: z.object({
            id: z.string().min(1),
            displayName: z.string(),
            path: z.string().min(1),
            kind: z.enum(['git', 'folder']).optional()
          })
        })
        .transform((result) => result.repo)
    )
  })
)
