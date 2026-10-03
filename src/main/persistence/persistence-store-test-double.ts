import type { Store } from '../persistence'
export function createPersistenceStoreTestDouble(methods: Partial<Store>): Store {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Focused persistence tests supply only exercised operations; their signatures are checked before the class boundary.
  return methods as Store
}
