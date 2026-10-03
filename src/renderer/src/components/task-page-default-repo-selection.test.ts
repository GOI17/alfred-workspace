import { describe, expect, it } from 'vitest'
import type { Repo } from '../../../shared/repo-types'
import {
  getDefaultTaskRepoSelection,
  getTaskEligibleRepos,
  getTaskProjectPickerGroups,
  getTaskProjectPickerRepos,
  normalizeTaskRepoSelection
} from './task-page-default-repo-selection'

function repo(overrides: Partial<Repo> & Pick<Repo, 'id'>): Repo {
  return {
    path: `/repos/${overrides.id}`,
    displayName: overrides.id,
    badgeColor: '#737373',
    addedAt: 100,
    kind: 'git',
    ...overrides
  }
}

describe('getTaskEligibleRepos', () => {
  it('keeps only Git repos with a resolvable remote identity', () => {
    const eligible = getTaskEligibleRepos([
      repo({ id: 'github-upstream', upstream: { owner: 'alfredlabs', repo: 'alfred' } }),
      repo({
        id: 'github-icon',
        repoIcon: {
          type: 'image',
          src: 'https://github.com/alfredlabs.png?size=64',
          source: 'github',
          label: 'GOI17/alfred-workspace'
        }
      }),
      repo({
        id: 'gitlab-remote',
        gitRemoteIdentity: {
          canonicalKey: 'gitlab.example.com/team/alfred',
          remoteName: 'origin',
          remoteUrl: 'git@gitlab.example.com:team/alfred.git'
        }
      }),
      repo({ id: 'settled-no-remote', gitRemoteIdentity: null }),
      repo({
        id: 'incomplete-remote',
        gitRemoteIdentity: {
          canonicalKey: 'gitlab.example.com/team/incomplete',
          remoteName: '',
          remoteUrl: 'git@gitlab.example.com:team/incomplete.git'
        }
      }),
      repo({
        id: 'folder-with-remote',
        kind: 'folder',
        upstream: { owner: 'alfredlabs', repo: 'docs' }
      })
    ])

    expect(eligible.map((candidate) => candidate.id)).toEqual([
      'github-upstream',
      'github-icon',
      'gitlab-remote'
    ])
  })

  it('keeps a repo visible while its remote identity probe has not answered', () => {
    const eligible = getTaskEligibleRepos([
      repo({ id: 'probe-pending' }),
      repo({ id: 'ssh-probe-pending', connectionId: 'builder' }),
      repo({ id: 'settled-no-remote', gitRemoteIdentity: null })
    ])

    expect(eligible.map((candidate) => candidate.id)).toEqual([
      'probe-pending',
      'ssh-probe-pending'
    ])
  })

  it('excludes folders and settled remote-less repos even while others are pending', () => {
    const eligible = getTaskEligibleRepos([
      repo({ id: 'folder-pending', kind: 'folder' }),
      repo({ id: 'folder-settled', kind: 'folder', gitRemoteIdentity: null }),
      repo({ id: 'git-pending' })
    ])

    expect(eligible.map((candidate) => candidate.id)).toEqual(['git-pending'])
  })

  it('treats a partially resolved remote identity as settled, not pending', () => {
    const eligible = getTaskEligibleRepos([
      repo({
        id: 'gitlab-ssh-partial',
        connectionId: 'builder',
        gitRemoteIdentity: {
          canonicalKey: 'gitlab.example.com/team/alfred',
          remoteName: 'origin',
          remoteUrl: ''
        }
      }),
      repo({
        id: 'gitlab-ssh-complete',
        connectionId: 'builder',
        gitRemoteIdentity: {
          canonicalKey: 'gitlab.example.com/team/alfred',
          remoteName: 'origin',
          remoteUrl: 'git@gitlab.example.com:team/alfred.git'
        }
      })
    ])

    expect(eligible.map((candidate) => candidate.id)).toEqual(['gitlab-ssh-complete'])
  })
})

describe('getDefaultTaskRepoSelection', () => {
  it('selects one source per logical GitHub project', () => {
    const selection = getDefaultTaskRepoSelection([
      repo({
        id: 'local-alfred',
        upstream: { owner: 'Alfredlabs', repo: 'Alfred' }
      }),
      repo({
        id: 'ssh-alfred',
        connectionId: 'builder',
        upstream: { owner: 'alfredlabs', repo: 'alfred' }
      }),
      repo({
        id: 'other',
        upstream: { owner: 'alfredlabs', repo: 'other' }
      })
    ])

    expect([...selection].sort()).toEqual(['local-alfred', 'other'])
  })

  it('keeps GitHub grouping intact while a pending-identity repo joins as its own project', () => {
    const selection = getDefaultTaskRepoSelection(
      getTaskEligibleRepos([
        repo({ id: 'local-alfred', upstream: { owner: 'Alfredlabs', repo: 'Alfred' } }),
        repo({
          id: 'ssh-alfred',
          connectionId: 'builder',
          upstream: { owner: 'alfredlabs', repo: 'alfred' }
        }),
        repo({ id: 'ssh-gitlab-pending', connectionId: 'builder' })
      ])
    )

    expect([...selection].sort()).toEqual(['local-alfred', 'ssh-gitlab-pending'])
  })

  it('prefers local checkout over a remote checkout for the same project', () => {
    const selection = getDefaultTaskRepoSelection([
      repo({
        id: 'ssh-alfred',
        addedAt: 1,
        connectionId: 'builder',
        upstream: { owner: 'alfredlabs', repo: 'alfred' }
      }),
      repo({
        id: 'local-alfred',
        addedAt: 2,
        upstream: { owner: 'alfredlabs', repo: 'alfred' }
      })
    ])

    expect([...selection]).toEqual(['local-alfred'])
  })

  it('keeps same-named folders separate when provider identity is missing', () => {
    const selection = getDefaultTaskRepoSelection([
      repo({ id: 'local-app', displayName: 'app' }),
      repo({ id: 'ssh-app', displayName: 'app', connectionId: 'builder' })
    ])

    expect([...selection].sort()).toEqual(['local-app', 'ssh-app'])
  })

  it('uses GitHub repo icon metadata to identify legacy duplicate projects', () => {
    const selection = getDefaultTaskRepoSelection([
      repo({
        id: 'local-claude-swap',
        displayName: 'claude-swap',
        repoIcon: {
          type: 'image',
          src: 'https://github.com/alfredlabs.png?size=64',
          source: 'github',
          label: 'alfredlabs/claude-swap'
        }
      }),
      repo({
        id: 'ssh-claude-swap',
        displayName: 'claude-swap',
        connectionId: 'builder',
        repoIcon: {
          type: 'image',
          src: 'https://github.com/alfredlabs.png?size=64',
          source: 'github',
          label: 'Alfredlabs/claude-swap'
        }
      })
    ])

    expect([...selection]).toEqual(['local-claude-swap'])
  })
})

describe('getTaskProjectPickerRepos', () => {
  it('shows one picker row per logical GitHub project', () => {
    const pickerRepos = getTaskProjectPickerRepos([
      repo({
        id: 'local-alfred',
        upstream: { owner: 'Alfredlabs', repo: 'Alfred' }
      }),
      repo({
        id: 'ssh-alfred',
        connectionId: 'builder',
        upstream: { owner: 'alfredlabs', repo: 'alfred' }
      }),
      repo({
        id: 'other',
        upstream: { owner: 'alfredlabs', repo: 'other' }
      })
    ])

    expect(pickerRepos.map((candidate) => candidate.id)).toEqual(['local-alfred', 'other'])
  })

  it('uses an explicitly selected remote source as the visible project row', () => {
    const pickerRepos = getTaskProjectPickerRepos(
      [
        repo({
          id: 'local-alfred',
          upstream: { owner: 'alfredlabs', repo: 'alfred' }
        }),
        repo({
          id: 'ssh-alfred',
          connectionId: 'builder',
          upstream: { owner: 'alfredlabs', repo: 'alfred' }
        })
      ],
      new Set(['ssh-alfred'])
    )

    expect(pickerRepos.map((candidate) => candidate.id)).toEqual(['ssh-alfred'])
  })

  it('collapses legacy local and SSH rows that share a GitHub repo icon identity', () => {
    const pickerRepos = getTaskProjectPickerRepos([
      repo({
        id: 'local-claude-swap',
        displayName: 'claude-swap',
        repoIcon: {
          type: 'image',
          src: 'https://github.com/alfredlabs.png?size=64',
          source: 'github',
          label: 'alfredlabs/claude-swap'
        }
      }),
      repo({
        id: 'ssh-claude-swap',
        displayName: 'claude-swap',
        connectionId: 'builder',
        repoIcon: {
          type: 'image',
          src: 'https://github.com/alfredlabs.png?size=64',
          source: 'github',
          label: 'Alfredlabs/claude-swap'
        }
      })
    ])

    expect(pickerRepos.map((candidate) => candidate.id)).toEqual(['local-claude-swap'])
  })
})

describe('getTaskProjectPickerGroups', () => {
  it('keeps all host sources under one logical project row', () => {
    const groups = getTaskProjectPickerGroups([
      repo({
        id: 'local-alfred',
        upstream: { owner: 'alfredlabs', repo: 'alfred' }
      }),
      repo({
        id: 'ssh-alfred',
        connectionId: 'builder',
        upstream: { owner: 'alfredlabs', repo: 'alfred' }
      }),
      repo({
        id: 'docs',
        upstream: { owner: 'alfredlabs', repo: 'docs' }
      })
    ])

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({
      projectKey: 'github:GOI17/alfred-workspace',
      repo: { id: 'local-alfred' }
    })
    expect(groups[0]?.sources.map((source) => source.id)).toEqual(['local-alfred', 'ssh-alfred'])
    expect(groups[1]).toMatchObject({
      projectKey: 'github:alfredlabs/docs',
      repo: { id: 'docs' }
    })
  })

  it('uses the explicitly selected source as the project representative', () => {
    const groups = getTaskProjectPickerGroups(
      [
        repo({
          id: 'local-alfred',
          upstream: { owner: 'alfredlabs', repo: 'alfred' }
        }),
        repo({
          id: 'ssh-alfred',
          connectionId: 'builder',
          upstream: { owner: 'alfredlabs', repo: 'alfred' }
        })
      ],
      new Set(['ssh-alfred'])
    )

    expect(groups[0]?.repo.id).toBe('ssh-alfred')
    expect(groups[0]?.sources.map((source) => source.id)).toEqual(['local-alfred', 'ssh-alfred'])
  })
})

describe('normalizeTaskRepoSelection', () => {
  it('collapses duplicate selected sources for the same logical project', () => {
    const selection = normalizeTaskRepoSelection(
      [
        repo({
          id: 'local-alfred',
          upstream: { owner: 'alfredlabs', repo: 'alfred' }
        }),
        repo({
          id: 'ssh-alfred',
          connectionId: 'builder',
          upstream: { owner: 'alfredlabs', repo: 'alfred' }
        })
      ],
      new Set(['local-alfred', 'ssh-alfred'])
    )

    expect([...selection]).toEqual(['local-alfred'])
  })

  it('preserves a single explicit remote source selection', () => {
    const selection = normalizeTaskRepoSelection(
      [
        repo({
          id: 'local-alfred',
          upstream: { owner: 'alfredlabs', repo: 'alfred' }
        }),
        repo({
          id: 'ssh-alfred',
          connectionId: 'builder',
          upstream: { owner: 'alfredlabs', repo: 'alfred' }
        })
      ],
      new Set(['ssh-alfred'])
    )

    expect([...selection]).toEqual(['ssh-alfred'])
  })

  it('normalizes raw all-host selection to one source per logical project', () => {
    const selection = normalizeTaskRepoSelection(
      [
        repo({
          id: 'local-alfred',
          upstream: { owner: 'alfredlabs', repo: 'alfred' }
        }),
        repo({
          id: 'ssh-alfred',
          connectionId: 'builder',
          upstream: { owner: 'alfredlabs', repo: 'alfred' }
        }),
        repo({
          id: 'docs',
          upstream: { owner: 'alfredlabs', repo: 'docs' }
        })
      ],
      new Set(['local-alfred', 'ssh-alfred', 'docs'])
    )

    expect([...selection].sort()).toEqual(['docs', 'local-alfred'])
  })
})
