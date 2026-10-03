import { describe, expect, it, vi } from 'vitest'
import { resolve } from 'node:path'
import {
  assertDeveloperIdSignature,
  verifyMacReleaseArtifact,
  verifyMacSignedUpdate
} from './verify-macos-release-artifact.mjs'

const team = 'ABCDEFGHIJ'
const candidateApp = resolve('candidate.app')
const previousApp = resolve('previous.app')
const details = [
  'Identifier=org.alfredlabs.workspace',
  'Authority=Developer ID Application: Alfredlabs (ABCDEFGHIJ)',
  'TeamIdentifier=ABCDEFGHIJ',
  'CodeDirectory v=20500 size=500 flags=0x10000(runtime) hashes=7+7 location=embedded',
  'Timestamp=Oct 3, 2026 at 00:00:00'
].join('\n')

function passingCommands() {
  return vi.fn((command, args) => {
    if (command === 'codesign' && args.includes('--verbose=4')) {
      return details
    }
    if (command === 'codesign' && args.includes('-r-')) {
      return 'designated => identifier "org.alfredlabs.workspace" and anchor apple generic'
    }
    if (command === 'lipo') {
      return 'arm64'
    }
    if (command === 'spctl' && args.includes('--status')) {
      return 'assessments enabled'
    }
    if (command === 'plutil') {
      return args.at(-1).includes('previous.app') ? '1.4.197' : '1.4.198'
    }
    return ''
  })
}

describe('macOS release artifact verification', () => {
  it.each([
    [
      details.replace('TeamIdentifier=ABCDEFGHIJ', 'TeamIdentifier=OTHERTEAM1'),
      'expected Apple team'
    ],
    [
      details.replace('Developer ID Application:', 'Apple Development:'),
      'Developer ID Application'
    ],
    [details.replace('0x10000(runtime)', '0x2(adhoc)'), 'Hardened runtime'],
    [details.replace(/Timestamp=.+/, ''), 'timestamp'],
    [
      details.replace('Identifier=org.alfredlabs.workspace', 'Identifier=org.other.app'),
      'identifier'
    ]
  ])('rejects an invalid release signature', (signature, error) => {
    expect(() => assertDeveloperIdSignature(signature, team, 'org.alfredlabs.workspace')).toThrow(
      error
    )
  })
  it('checks the bundle, each nested helper, ticket and Gatekeeper', () => {
    const execute = passingCommands()
    expect(verifyMacReleaseArtifact(candidateApp, team, execute).version).toBe('1.4.198')
    expect(
      execute.mock.calls.filter(
        ([command, args]) => command === 'codesign' && args.includes('--verbose=4')
      )
    ).toHaveLength(4)
    expect(execute).toHaveBeenCalledWith('xcrun', ['stapler', 'validate', candidateApp])
    expect(execute).toHaveBeenCalledWith('spctl', [
      '--assess',
      '--type',
      'execute',
      '--verbose=2',
      candidateApp
    ])
  })
  it.each(['xcrun', 'spctl', 'codesign'])(
    'propagates a failed system verification: %s',
    (failedCommand) => {
      const passing = passingCommands()
      const execute = (command, args) => {
        if (command === failedCommand) {
          throw new Error('system verification rejected')
        }
        return passing(command, args)
      }
      expect(() => verifyMacReleaseArtifact(candidateApp, team, execute)).toThrow(
        'system verification rejected'
      )
    }
  )
  it('rejects a wrong-team nested helper', () => {
    const passing = passingCommands()
    const execute = (command, args) =>
      args.at(-1).endsWith('alfred-keyboard-layout')
        ? details.replace('TeamIdentifier=ABCDEFGHIJ', 'TeamIdentifier=OTHERTEAM1')
        : passing(command, args)
    expect(() => verifyMacReleaseArtifact(candidateApp, team, execute)).toThrow(
      'expected Apple team'
    )
  })
  it('rejects an Intel executable', () => {
    const passing = passingCommands()
    expect(() =>
      verifyMacReleaseArtifact(candidateApp, team, (command, args) =>
        command === 'lipo' ? 'x86_64' : passing(command, args)
      )
    ).toThrow('Apple Silicon')
  })
  it('requires the candidate to satisfy the previous app signing requirement', () => {
    const execute = passingCommands()
    const result = verifyMacSignedUpdate(previousApp, candidateApp, team, execute)
    expect(result.previous.version).toBe('1.4.197')
    expect(result.candidate.version).toBe('1.4.198')
    expect(execute).toHaveBeenCalledWith('codesign', [
      '--verify',
      '--strict',
      '-R',
      'identifier "org.alfredlabs.workspace" and anchor apple generic',
      candidateApp
    ])
  })
  it('rejects the same version', () => {
    expect(() =>
      verifyMacSignedUpdate(candidateApp, candidateApp, team, passingCommands())
    ).toThrow('different version')
  })
  it('propagates rejection of the previous signature requirement', () => {
    const passing = passingCommands()
    const execute = (command, args) => {
      if (args.includes('-R')) {
        throw new Error('requirement mismatch')
      }
      return passing(command, args)
    }
    expect(() => verifyMacSignedUpdate(previousApp, candidateApp, team, execute)).toThrow(
      'requirement mismatch'
    )
  })
  it('rejects disabled Gatekeeper instead of accepting an unchecked release', () => {
    const passing = passingCommands()
    const execute = (command, args) =>
      command === 'spctl' && args.includes('--status')
        ? 'assessments disabled'
        : passing(command, args)
    expect(() => verifyMacReleaseArtifact(candidateApp, team, execute)).toThrow(
      'Gatekeeper assessments'
    )
  })
  it('rejects a missing previous signing requirement', () => {
    const passing = passingCommands()
    const execute = (command, args) => (args.includes('-r-') ? '' : passing(command, args))
    expect(() => verifyMacSignedUpdate(previousApp, candidateApp, team, execute)).toThrow(
      'no designated signing requirement'
    )
  })
})
