export const ALFRED_EDITOR_SAVE_DIRTY_FILES_EVENT = 'alfred:editor-save-dirty-files'
export const ALFRED_EDITOR_PREPARE_HOT_EXIT_EVENT = 'alfred:editor-prepare-hot-exit'

export type EditorSaveDirtyFilesDetail = {
  claim: () => void
  resolve: () => void
  reject: (message: string) => void
}

export type EditorPrepareHotExitDetail = EditorSaveDirtyFilesDetail
