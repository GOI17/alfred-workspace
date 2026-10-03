import type { GlobalSettings } from '../../shared/global-settings-types'
import type { RuntimeStore } from './runtime-store-contract'

type StoreSettings = ReturnType<RuntimeStore['getSettings']>
type StoreMethods = Omit<Partial<RuntimeStore>, 'getSettings'> & {
  getSettings?: () => Partial<StoreSettings & Omit<GlobalSettings, keyof StoreSettings>>
}

export function createRuntimeStoreTestDouble<Methods extends StoreMethods>(
  methods: Methods
): RuntimeStore {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Tests supply only the store operations and settings they exercise; their supplied values are checked above.
  return methods as RuntimeStore
}
