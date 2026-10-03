import type { ProjectExecutionRuntimeResolution } from '../../../shared/project-execution-runtime'
import { isWslUncPath } from '../../../shared/wsl-paths'
import { splitWorktreeIdForFilesystem } from '../../../shared/worktree/id'

export type OrchestrationCliCommand = 'alfred' | 'alfred-dev' | 'alfred-ide'

export function resolveTerminalOrchestrationCliCommand(args: {
  connectionId: string | null
  isWsl: boolean | null | undefined
  worktreeId: string
  projectRuntime?: ProjectExecutionRuntimeResolution
  runtimeCliCommand?: OrchestrationCliCommand
}): OrchestrationCliCommand {
  if (args.connectionId) {
    return 'alfred'
  }
  if (args.runtimeCliCommand) {
    return args.runtimeCliCommand
  }
  if (args.isWsl !== null && args.isWsl !== undefined) {
    return args.isWsl ? 'alfred-ide' : 'alfred'
  }
  if (args.projectRuntime?.status === 'resolved' && args.projectRuntime.runtime.kind === 'wsl') {
    return 'alfred-ide'
  }

  const worktreePath = splitWorktreeIdForFilesystem(args.worktreeId)?.worktreePath
  return worktreePath && isWslUncPath(worktreePath) ? 'alfred-ide' : 'alfred'
}
