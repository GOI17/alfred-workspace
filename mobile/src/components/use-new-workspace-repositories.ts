import { useEffect, useRef, useState } from 'react'
import type { RpcClient } from '../transport/rpc-client'
import type { RpcSuccess } from '../transport/types'
import { getCachedRepos, setCachedRepos } from '../cache/repo-cache'
import { useLastVisitedWorktreeRepoId } from '../worktree/use-last-visited-worktree-repo'
import {
  getMobileNewWorkspaceDialogEligibleRepos,
  refreshMobileNewWorkspaceDialogSelectedRepo,
  resolveMobileNewWorkspaceDialogRepoId
} from '../worktree/new-workspace-dialog-repo-selection'
import type { MobileWorkspaceRepo } from './new-worktree-modal-types'

export function useNewWorkspaceRepositories(args: {
  client: RpcClient | null
  hostId?: string
  visible: boolean
}): {
  repos: MobileWorkspaceRepo[]
  selectedRepo: MobileWorkspaceRepo | null
  setSelectedRepo: (repo: MobileWorkspaceRepo | null) => void
  loading: boolean
  upsertRepo: (repo: MobileWorkspaceRepo) => void
} {
  const { client, hostId, visible } = args
  const [initialRepos] = useState(() =>
    hostId ? (getCachedRepos(hostId) as MobileWorkspaceRepo[] | null) : null
  )
  const addedRepos = useRef(new Map<string, MobileWorkspaceRepo>())
  const [repos, setRepos] = useState<MobileWorkspaceRepo[]>(initialRepos ?? [])
  const [selectedRepo, setSelectedRepo] = useState<MobileWorkspaceRepo | null>(null)
  const [loading, setLoading] = useState(initialRepos == null)
  const lastVisitedRepo = useLastVisitedWorktreeRepoId(hostId, visible)

  useEffect(() => {
    if (!visible || !lastVisitedRepo.loaded || selectedRepo || repos.length === 0) {
      return
    }
    const eligibleRepos = getMobileNewWorkspaceDialogEligibleRepos(repos)
    const preferredRepoId = resolveMobileNewWorkspaceDialogRepoId({
      eligibleRepos,
      activeRepoId: lastVisitedRepo.repoId
    })
    const preferredRepo = repos.find((repo) => repo.id === preferredRepoId) ?? null
    if (preferredRepo) {
      setSelectedRepo(preferredRepo)
    }
  }, [lastVisitedRepo.loaded, lastVisitedRepo.repoId, repos, selectedRepo, visible])

  useEffect(() => {
    if (!visible || !client) {
      return
    }
    let stale = false
    setLoading(true)
    void client
      .sendRequest('repo.list')
      .then((response) => {
        if (stale || !response.ok) {
          return
        }
        const result = (response as RpcSuccess).result as { repos: MobileWorkspaceRepo[] }
        // Keep additions made while this list request was in flight.
        const nextRepos = [
          ...result.repos.filter((repo) => !addedRepos.current.has(repo.id)),
          ...addedRepos.current.values()
        ]
        addedRepos.current.clear()
        setRepos(nextRepos)
        if (hostId) {
          setCachedRepos(hostId, nextRepos)
        }
        setSelectedRepo((current) =>
          refreshMobileNewWorkspaceDialogSelectedRepo(nextRepos, current)
        )
      })
      .catch(() => undefined)
      .finally(() => {
        if (!stale) {
          setLoading(false)
        }
      })
    return () => {
      stale = true
    }
  }, [visible, client, hostId])

  function upsertRepo(repo: MobileWorkspaceRepo): void {
    addedRepos.current.set(repo.id, repo)
    setRepos((current) => [...current.filter((entry) => entry.id !== repo.id), repo])
    if (hostId) {
      setCachedRepos(hostId, [...repos.filter((entry) => entry.id !== repo.id), repo])
    }
  }

  return {
    upsertRepo,
    repos,
    selectedRepo,
    setSelectedRepo,
    loading: loading && repos.length === 0
  }
}
