import type { Repo } from './repo-types'
export function makeRepo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: 'repo-1',
    path: '/tmp/lineage-order',
    displayName: 'lineage-order',
    badgeColor: '#999999',
    addedAt: 1,
    ...overrides
  }
}
