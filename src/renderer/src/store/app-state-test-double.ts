import type { AppState } from './types'
export function createAppStateTestDouble(state: Partial<AppState>): AppState {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Slice tests exercise only their supplied state; every supplied field retains its AppState type.
  return state as AppState
}
