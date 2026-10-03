import { makeRepo as fixtureMakeRepo } from '../../../shared/repo-test-fixture'
import { describe, expect, it } from 'vitest'
import { buildGitLabProviderIdentity, getTaskPageRepoCacheInput } from './task-page-source-context'

describe('buildGitLabProviderIdentity', () => {
  it('splits namespace and project and builds the web URL', () => {
    expect(
      buildGitLabProviderIdentity({
        host: 'gitlab.example.com',
        path: 'acme/platform/alfred'
      })
    ).toEqual({
      provider: 'gitlab',
      projectId: 'acme/platform/alfred',
      namespace: 'acme/platform',
      project: 'alfred',
      webUrl: 'https://gitlab.example.com/acme/platform/alfred'
    })
  })

  it('treats a single path segment as the project with no namespace', () => {
    expect(
      buildGitLabProviderIdentity({
        host: 'gitlab.com',
        path: 'solo'
      })
    ).toEqual({
      provider: 'gitlab',
      projectId: 'solo',
      namespace: null,
      project: 'solo',
      webUrl: 'https://gitlab.com/solo'
    })
  })
})

describe('getTaskPageRepoCacheInput', () => {
  it('copies repo identity fields used by the GitHub work-item cache', () => {
    const repo = fixtureMakeRepo({
      id: 'repo-1',
      path: '/tmp/alfred',
      executionHostId: 'local'
    })
    const input = getTaskPageRepoCacheInput(repo)
    expect(input.id).toBe('repo-1')
    expect(input.path).toBe('/tmp/alfred')
    expect(input.executionHostId).toBe('local')
  })
})
