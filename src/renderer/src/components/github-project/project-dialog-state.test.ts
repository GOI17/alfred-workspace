import { describe, expect, it } from 'vitest'
import {
  resolveMissingRepoProjectDialogState,
  resolveRepoBackedProjectDialogState
} from './project-dialog-state'

describe('resolveRepoBackedProjectDialogState', () => {
  it('keeps a repo-backed dialog when the repo still exists', () => {
    const dialog = { repoId: 'repo-1', label: 'Issue 1' }

    expect(
      resolveRepoBackedProjectDialogState(dialog, new Set(['repo-1']), new Set(['repo-1']))
    ).toBe(dialog)
  })

  it('clears a repo-backed dialog when its repo is removed', () => {
    expect(
      resolveRepoBackedProjectDialogState(
        { repoId: 'repo-1' },
        new Set(['repo-2']),
        new Set(['repo-1'])
      )
    ).toBeNull()
  })

  it('clears a repo-backed dialog when its repo is no longer selected', () => {
    expect(
      resolveRepoBackedProjectDialogState(
        { repoId: 'repo-1' },
        new Set(['repo-1']),
        new Set(['repo-2'])
      )
    ).toBeNull()
  })
})

describe('resolveMissingRepoProjectDialogState', () => {
  it('clears fallback dialogs while the slug index is rebuilding', () => {
    const slugDialog = { origin: { owner: 'alfredlabs', repo: 'alfred' } }
    const repoNotInAlfred = { owner: 'alfredlabs', repo: 'alfred', url: null }

    expect(
      resolveMissingRepoProjectDialogState({
        slugIndexReady: false,
        slugDialog,
        repoNotInAlfred,
        lookupSlug: () => [{ id: 'repo-1' }],
        selectedRepoIds: new Set(['repo-1'])
      })
    ).toEqual({ slugDialog: null, repoNotInAlfred: null })
  })

  it('clears slug fallback dialogs once the repo slug resolves', () => {
    const slugDialog = { origin: { owner: 'alfredlabs', repo: 'alfred' } }
    const repoNotInAlfred = { owner: 'other', repo: 'tool', url: null }
    const result = resolveMissingRepoProjectDialogState({
      slugIndexReady: true,
      slugDialog,
      repoNotInAlfred,
      lookupSlug: (slug) => (slug === 'GOI17/alfred-workspace' ? [{ id: 'repo-1' }] : []),
      selectedRepoIds: new Set(['repo-1'])
    })

    expect(result.slugDialog).toBeNull()
    expect(result.repoNotInAlfred).toBe(repoNotInAlfred)
  })

  it('clears repo-not-in-alfred dialogs once the repo slug resolves', () => {
    const slugDialog = { origin: { owner: 'other', repo: 'tool' } }
    const repoNotInAlfred = { owner: 'alfredlabs', repo: 'alfred', url: null }
    const result = resolveMissingRepoProjectDialogState({
      slugIndexReady: true,
      slugDialog,
      repoNotInAlfred,
      lookupSlug: (slug) => (slug === 'GOI17/alfred-workspace' ? [{ id: 'repo-1' }] : []),
      selectedRepoIds: new Set(['repo-1'])
    })

    expect(result.slugDialog).toBe(slugDialog)
    expect(result.repoNotInAlfred).toBeNull()
  })

  it('clears fallback dialogs when the repo is globally known but not selected', () => {
    const slugDialog = { origin: { owner: 'alfredlabs', repo: 'alfred' } }
    const repoNotInAlfred = { owner: 'alfredlabs', repo: 'alfred', url: null }
    const result = resolveMissingRepoProjectDialogState({
      slugIndexReady: true,
      slugDialog,
      repoNotInAlfred,
      lookupSlug: () => [{ id: 'repo-2' }],
      selectedRepoIds: new Set(['repo-1'])
    })

    expect(result).toEqual({ slugDialog: null, repoNotInAlfred: null })
  })

  it('keeps missing-repo fallback dialogs when there are no global matches', () => {
    const slugDialog = { origin: { owner: 'alfredlabs', repo: 'alfred' } }
    const repoNotInAlfred = { owner: 'alfredlabs', repo: 'alfred', url: null }
    const result = resolveMissingRepoProjectDialogState({
      slugIndexReady: true,
      slugDialog,
      repoNotInAlfred,
      lookupSlug: () => [],
      selectedRepoIds: new Set(['repo-1'])
    })

    expect(result).toEqual({ slugDialog, repoNotInAlfred })
  })
})
