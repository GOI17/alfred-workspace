import { z } from 'zod'

export const SshTarget = z.object({
  targetId: z.string().min(1)
})

export const SshBrowseDirectory = SshTarget.extend({ dirPath: z.string().min(1) })
