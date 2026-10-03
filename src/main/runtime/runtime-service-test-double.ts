import type { AlfredRuntimeService } from './alfred-runtime'

export function createRuntimeServiceTestDouble<Methods extends Partial<AlfredRuntimeService>>(
  methods: Methods
): AlfredRuntimeService {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Test cases exercise only the supplied, type-checked methods; the concrete class also has private state.
  return methods as AlfredRuntimeService
}
