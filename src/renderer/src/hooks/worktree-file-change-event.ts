import type { FsChangedPayload } from '../../../shared/filesystem-entry-types'

export const ALFRED_WORKTREE_FILE_CHANGE_EVENT = 'alfred:worktree-file-change'

export type WorktreeFileChangeEventDetail = {
  payload: FsChangedPayload
  runtimeEnvironmentId: string | null
}
