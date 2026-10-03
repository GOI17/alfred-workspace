import { describe, expect, it } from 'vitest'
import {
  extractGitHubIssueSourceError,
  extractGitHubIssueSourceFallback
} from './github-work-item-source-errors'

describe('extractGitHubIssueSourceError', () => {
  it('keeps the failing issue source slug with the repo that produced it', () => {
    expect(
      extractGitHubIssueSourceError(
        { id: 'repo-1', path: '/work/alfred' },
        {
          sources: { issues: { owner: 'upstream', repo: 'alfred' } },
          errors: { issues: { message: 'HTTP 403: resource not accessible' } }
        }
      )
    ).toEqual({
      repoId: 'repo-1',
      repoPath: '/work/alfred',
      source: { owner: 'upstream', repo: 'alfred' },
      message: 'HTTP 403: resource not accessible'
    })
  })

  it('drops issue errors when the source slug is unavailable', () => {
    expect(
      extractGitHubIssueSourceError(
        { id: 'repo-1', path: '/work/alfred' },
        {
          sources: { issues: null },
          errors: { issues: { message: 'failed' } }
        }
      )
    ).toBeNull()
  })

  it('returns null when the envelope has no issue-side error', () => {
    expect(
      extractGitHubIssueSourceError(
        { id: 'repo-1', path: '/work/alfred' },
        {
          sources: { issues: { owner: 'GOI17', repo: 'alfred-workspace' } }
        }
      )
    ).toBeNull()
  })
})

describe('extractGitHubIssueSourceFallback', () => {
  it('reports the repo whose upstream issue source fell back to origin', () => {
    expect(
      extractGitHubIssueSourceFallback(
        { id: 'repo-1', path: '/work/alfred', displayName: 'alfred' },
        {
          issueSourceFellBack: true,
          sources: {
            issues: { owner: 'alfredlabs', repo: 'alfred-fork' },
            prs: { owner: 'GOI17', repo: 'alfred-workspace' }
          }
        }
      )
    ).toEqual({
      repoId: 'repo-1',
      repoPath: '/work/alfred',
      repoLabel: 'GOI17/alfred-workspace'
    })
  })

  it('uses the Alfred repo display name when the PR source is unavailable', () => {
    expect(
      extractGitHubIssueSourceFallback(
        { id: 'repo-1', path: '/work/alfred', displayName: 'alfred' },
        {
          issueSourceFellBack: true,
          sources: { issues: null, prs: null }
        }
      )
    ).toEqual({
      repoId: 'repo-1',
      repoPath: '/work/alfred',
      repoLabel: 'alfred'
    })
  })

  it('returns null when the source resolver did not fall back', () => {
    expect(
      extractGitHubIssueSourceFallback(
        { id: 'repo-1', path: '/work/alfred', displayName: 'alfred' },
        {
          sources: { issues: { owner: 'GOI17', repo: 'alfred-workspace' } }
        }
      )
    ).toBeNull()
  })
})
