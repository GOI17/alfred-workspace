/**
 * The build identity the deploy expects the host to answer with.
 *
 * It must be computed the same way `computeAlfreddBuildHash` computes it on the host —
 * sha256 of `alfredd.js`, first 16 hex characters — or the activation gate would reject every
 * healthy candidate. Keeping the two in one comment is deliberate: they are one contract
 * split across a network, and the version string cannot stand in for it, because
 * `ALFRED_VERSION` is whatever the launch command exported and two builds can carry one value.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const ALFREDD_BUILD_HASH_LENGTH = 16

export function computeLocalAlfreddBuildHash(localAlfreddDir: string): string {
  const entry = join(localAlfreddDir, 'alfredd.js')
  return createHash('sha256')
    .update(readFileSync(entry))
    .digest('hex')
    .slice(0, ALFREDD_BUILD_HASH_LENGTH)
}
