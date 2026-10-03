import type { SkillInstallDestination } from '../../shared/skill-install-contract'
import type { AlfredRuntimeService } from '../runtime/alfred-runtime'

export async function classifySkillCloudInstallTarget(
  runtime: AlfredRuntimeService,
  input: { environmentId?: string; destination: SkillInstallDestination }
): Promise<'local' | 'remote'> {
  return input.environmentId || (await runtime.skillInstallDestinationUsesSsh(input.destination))
    ? 'remote'
    : 'local'
}
