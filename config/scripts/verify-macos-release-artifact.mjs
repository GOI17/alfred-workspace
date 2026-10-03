#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const { appId } = JSON.parse(
  readFileSync(
    new URL('../../src/shared/local-build-compatibility-contract.json', import.meta.url),
    'utf8'
  )
)

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 120_000 })
  if (result.error || result.status !== 0) {
    throw new Error(
      `${command} failed: ${result.error?.message ?? result.stderr?.trim() ?? result.status}`
    )
  }
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
}

export function assertDeveloperIdSignature(details, teamId, expectedId) {
  if (!/^[A-Z0-9]{10}$/.test(teamId ?? '')) {
    throw new Error('Set APPLE_TEAM_ID to the expected ten-character team identifier.')
  }
  if (!details.split('\n').includes(`TeamIdentifier=${teamId}`)) {
    throw new Error('Signature does not belong to the expected Apple team.')
  }
  if (!/^Authority=Developer ID Application:/m.test(details)) {
    throw new Error('A Developer ID Application signature is required.')
  }
  if (!/^CodeDirectory .*flags=.*\bruntime\b/m.test(details)) {
    throw new Error('Hardened runtime is not enabled.')
  }
  if (!/^Timestamp=.+/m.test(details)) {
    throw new Error('A secure signing timestamp is required.')
  }
  if (expectedId && !details.split('\n').includes(`Identifier=${expectedId}`)) {
    throw new Error('Unexpected Alfred application identifier.')
  }
}

export function verifyMacReleaseArtifact(appPath, teamId, execute = run) {
  const bundle = resolve(appPath)
  execute('codesign', ['--verify', '--deep', '--strict', bundle])
  assertDeveloperIdSignature(
    execute('codesign', ['--display', '--verbose=4', bundle]),
    teamId,
    appId
  )
  for (const target of [
    join(bundle, 'Contents', 'Resources', 'Alfred Computer Use.app'),
    join(bundle, 'Contents', 'MacOS', 'alfred-notification-status'),
    join(bundle, 'Contents', 'MacOS', 'alfred-keyboard-layout')
  ]) {
    assertDeveloperIdSignature(execute('codesign', ['--display', '--verbose=4', target]), teamId)
  }
  const arch = execute('lipo', ['-archs', join(bundle, 'Contents', 'MacOS', 'Alfred workspace')])
  if (arch.trim() !== 'arm64') {
    throw new Error('The release executable must target Apple Silicon only.')
  }
  execute('xcrun', ['stapler', 'validate', bundle])
  if (execute('spctl', ['--status']).trim() !== 'assessments enabled') {
    throw new Error('Gatekeeper assessments must be enabled to validate release acceptance.')
  }
  execute('spctl', ['--assess', '--type', 'execute', '--verbose=2', bundle])
  const version = execute('plutil', [
    '-extract',
    'CFBundleShortVersionString',
    'raw',
    '-o',
    '-',
    join(bundle, 'Contents', 'Info.plist')
  ]).trim()
  if (!version) {
    throw new Error('The application version is missing.')
  }
  return { bundle, version, teamId }
}

export function verifyMacSignedUpdate(previousApp, candidateApp, teamId, execute = run) {
  const previous = verifyMacReleaseArtifact(previousApp, teamId, execute)
  const candidate = verifyMacReleaseArtifact(candidateApp, teamId, execute)
  if (previous.version === candidate.version) {
    throw new Error('The signed update must have a different version.')
  }
  const requirements = execute('codesign', ['--display', '-r-', previous.bundle])
  const requirement = requirements.match(/^designated => (.+)$/m)?.[1]
  if (!requirement) {
    throw new Error('The installed application has no designated signing requirement.')
  }
  execute('codesign', ['--verify', '--strict', '-R', requirement, candidate.bundle])
  return { previous, candidate }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.platform !== 'darwin') {
      throw new Error('Run macOS signature verification on a Mac.')
    }
    const [candidate, previous] = process.argv.slice(2)
    if (!candidate) {
      throw new Error('Usage: verify-macos-release-artifact.mjs <candidate.app> [previous.app]')
    }
    const result = previous
      ? verifyMacSignedUpdate(previous, candidate, process.env.APPLE_TEAM_ID)
      : verifyMacReleaseArtifact(candidate, process.env.APPLE_TEAM_ID)
    console.log(JSON.stringify(result, null, 2))
    if (previous) {
      console.log(
        'Signing prerequisites passed; installation, relaunch and state recovery still require an update test.'
      )
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
