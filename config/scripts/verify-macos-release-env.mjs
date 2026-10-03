#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export function verifyMacReleaseEnvironment(
  env = process.env,
  readIdentities = () =>
    execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], {
      encoding: 'utf8',
      timeout: 10_000
    })
) {
  const present = (key) => typeof env[key] === 'string' && env[key].trim().length > 0
  const requireKeys = (keys) => {
    const missing = keys.filter((key) => !present(key))
    if (missing.length) {
      throw new Error(`Missing macOS release settings: ${missing.join(', ')}`)
    }
  }
  requireKeys(['APPLE_TEAM_ID'])
  if (!/^[A-Z0-9]{10}$/.test(env.APPLE_TEAM_ID)) {
    throw new Error('APPLE_TEAM_ID must be the ten-character Apple Developer team identifier.')
  }
  if (present('CSC_LINK')) {
    requireKeys(['CSC_KEY_PASSWORD'])
  } else {
    requireKeys(['CSC_NAME'])
    const identities = readIdentities().split('\n')
    if (
      !identities.some(
        (line) =>
          line.includes('Developer ID Application:') &&
          line.includes(`(${env.APPLE_TEAM_ID})`) &&
          line.includes(env.CSC_NAME)
      )
    ) {
      throw new Error(
        'CSC_NAME must select an installed Developer ID Application identity for APPLE_TEAM_ID.'
      )
    }
  }
  // Match electron-builder's precedence so a partial higher-priority method cannot mask a failure.
  if (env.APPLE_ID || env.APPLE_APP_SPECIFIC_PASSWORD) {
    requireKeys(['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD'])
  } else if (['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'].some((key) => env[key])) {
    requireKeys(['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'])
  } else {
    requireKeys(['APPLE_KEYCHAIN_PROFILE'])
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    verifyMacReleaseEnvironment()
    console.log(
      'macOS signing and notarization settings are configured; artifact verification is still required.'
    )
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
