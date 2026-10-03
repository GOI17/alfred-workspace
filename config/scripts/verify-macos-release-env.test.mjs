import { describe, expect, it } from 'vitest'
import { verifyMacReleaseEnvironment } from './verify-macos-release-env.mjs'

const certificate = {
  APPLE_TEAM_ID: 'ABCDEFGHIJ',
  CSC_LINK: '/certificate.p12',
  CSC_KEY_PASSWORD: 'test-only'
}
const appleId = { APPLE_ID: 'test@example.invalid', APPLE_APP_SPECIFIC_PASSWORD: 'test-only' }
const installed = '1) ABCDEF1234 "Developer ID Application: Alfredlabs (ABCDEFGHIJ)"'

describe('macOS release environment', () => {
  it.each([
    appleId,
    { APPLE_KEYCHAIN_PROFILE: 'alfred-notary' },
    { APPLE_API_KEY: '/key.p8', APPLE_API_KEY_ID: 'KEY123', APPLE_API_ISSUER: 'issuer' }
  ])('accepts a complete notarization method with an imported certificate', (notary) => {
    expect(() => verifyMacReleaseEnvironment({ ...certificate, ...notary })).not.toThrow()
  })
  it('accepts an explicitly selected local Developer ID for the expected team', () => {
    expect(() =>
      verifyMacReleaseEnvironment(
        {
          APPLE_TEAM_ID: 'ABCDEFGHIJ',
          CSC_NAME: 'Alfredlabs',
          APPLE_KEYCHAIN_PROFILE: 'alfred-notary'
        },
        () => installed
      )
    ).not.toThrow()
  })
  it.each([
    '',
    'Developer ID Application: Alfredlabs (OTHERTEAM1)',
    'Apple Distribution: Alfredlabs (ABCDEFGHIJ)'
  ])('rejects unavailable or wrong signing identities', (identities) => {
    expect(() =>
      verifyMacReleaseEnvironment(
        { APPLE_TEAM_ID: 'ABCDEFGHIJ', CSC_NAME: 'Alfredlabs', ...appleId },
        () => identities
      )
    ).toThrow('installed Developer ID Application')
  })
  it('rejects incomplete Apple ID credentials even when a keychain profile exists', () => {
    expect(() =>
      verifyMacReleaseEnvironment({
        ...certificate,
        APPLE_ID: appleId.APPLE_ID,
        APPLE_KEYCHAIN_PROFILE: 'alfred-notary'
      })
    ).toThrow('APPLE_APP_SPECIFIC_PASSWORD')
  })
  it('rejects incomplete API credentials even when a keychain profile exists', () => {
    expect(() =>
      verifyMacReleaseEnvironment({
        ...certificate,
        APPLE_API_KEY: '/key.p8',
        APPLE_KEYCHAIN_PROFILE: 'alfred-notary'
      })
    ).toThrow('APPLE_API_KEY_ID, APPLE_API_ISSUER')
  })
  it('fails before building when no notarization method is configured', () => {
    expect(() => verifyMacReleaseEnvironment(certificate)).toThrow('APPLE_KEYCHAIN_PROFILE')
  })
  it('rejects missing signing credentials', () => {
    expect(() => verifyMacReleaseEnvironment({ APPLE_TEAM_ID: 'ABCDEFGHIJ', ...appleId })).toThrow(
      'CSC_NAME'
    )
  })
  it('rejects invalid team identifiers', () => {
    expect(() =>
      verifyMacReleaseEnvironment({ ...certificate, APPLE_TEAM_ID: '-', ...appleId })
    ).toThrow('ten-character')
  })
})
