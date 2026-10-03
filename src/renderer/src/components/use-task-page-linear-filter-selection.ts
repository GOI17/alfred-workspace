import type { TaskPageLinearListSelectionPreludeModel } from './use-task-page-linear-list-selection'
import { useMemo, useCallback, useEffect, useRef } from 'react'
import { resolveLinearIssueAttributeFilterPrimaryTeam } from '@/components/linear-issue-attribute-filter-primary-team'
import {
  type LinearIssueAttributeFilter,
  linearIssueAttributeFilterSignature
} from '../../../shared/linear/issue-attribute-filter'
import { setLinearWorkspaceIssueFilter } from '../../../shared/linear/issue-view-resume-state'
import { LINEAR_ITEM_LIMIT } from './task-page-source-context'
import {
  type LinearPrimaryTeamObservation,
  shouldClearTeamDerivedFacets,
  teamDerivedFacetsForPrimaryTeamChange,
  isLinearIssueSearchActive
} from '@/components/task-page-linear-issue-request'
import { folderWorkspaceToWorktree } from '../../../shared/folder-workspace-worktree'
import { buildLinearIssueWorkspaceAttachmentIndex } from '@/lib/linear-issue-workspace-attachment'
import {
  collectLinkedLinearIssueRefsFromWorktrees,
  linkedLinearIssueRefsSignature
} from '@/components/task-page-linear-in-alfred-issues'
export function useTaskPageLinearFilterSelection(model: TaskPageLinearListSelectionPreludeModel) {
  const {
    allWorktrees,
    linearStatus,
    folderWorkspaces,
    selectedLinearWorkspaceId,
    linearMode,
    setLinearIssueLimit,
    setLinearIssuePage,
    setLinearIssueLoadingTargetPage,
    linearSearchInput,
    appliedLinearSearch,
    setLinearIssueFiltersByWorkspaceId,
    linearAttributeFilterWorkspaceId,
    linearAttributeFilter,
    linearPrimaryTeamRef,
    availableTeams,
    linearTeamSelection,
    activeLinearIssueContextLabel,
    linearTeamOptions
  } = model
  const linearAttributePrimaryTeam = useMemo(
    () =>
      resolveLinearIssueAttributeFilterPrimaryTeam({
        selectedTeamIds: [...linearTeamSelection],
        availableTeams: linearTeamOptions
      }),
    [linearTeamOptions, linearTeamSelection]
  )
  const applyLinearAttributeFilter = useCallback(
    (next: LinearIssueAttributeFilter) => {
      if (linearAttributeFilterWorkspaceId) {
        setLinearIssueFiltersByWorkspaceId((previous) =>
          setLinearWorkspaceIssueFilter(previous, linearAttributeFilterWorkspaceId, next)
        )
      }
      setLinearIssueLimit(LINEAR_ITEM_LIMIT)
      setLinearIssuePage(0)
      setLinearIssueLoadingTargetPage(null)
    },
    [
      linearAttributeFilterWorkspaceId,
      setLinearIssuePage,
      setLinearIssueFiltersByWorkspaceId,
      setLinearIssueLoadingTargetPage,
      setLinearIssueLimit
    ]
  )
  useEffect(() => {
    const nextTeamId = availableTeams.length > 0 ? (linearAttributePrimaryTeam?.id ?? null) : null
    if (!nextTeamId) {
      return
    }
    const previous = linearPrimaryTeamRef.current
    const next: LinearPrimaryTeamObservation = {
      workspaceId: linearAttributeFilterWorkspaceId,
      teamId: nextTeamId
    }
    linearPrimaryTeamRef.current = next
    if (
      !shouldClearTeamDerivedFacets({
        previous,
        next
      })
    ) {
      return
    }
    // Why: team-scoped facets; clearing them is a filter change, so reset limit/page via applyLinearAttributeFilter (R6), not a bare set.
    const cleared = teamDerivedFacetsForPrimaryTeamChange(linearAttributeFilter)
    if (
      linearIssueAttributeFilterSignature(linearAttributeFilter) ===
      linearIssueAttributeFilterSignature(cleared)
    ) {
      return
    }
    applyLinearAttributeFilter(cleared)
  }, [
    applyLinearAttributeFilter,
    availableTeams.length,
    linearAttributeFilter,
    linearAttributeFilterWorkspaceId,
    linearAttributePrimaryTeam?.id,
    linearPrimaryTeamRef
  ])
  const linearSearchActive = isLinearIssueSearchActive(linearSearchInput, appliedLinearSearch)
  const showLinearAttributeFilters =
    linearMode === 'issues' && !activeLinearIssueContextLabel && !linearSearchActive

  // Why: one pass over worktrees per list render; per-row scans re-parsed every link.
  const linearAttachmentWorkspaces = useMemo(
    () => [...allWorktrees, ...folderWorkspaces.map(folderWorkspaceToWorktree)],
    [allWorktrees, folderWorkspaces]
  )
  const linearIssueAttachmentIndex = useMemo(
    () => buildLinearIssueWorkspaceAttachmentIndex(linearAttachmentWorkspaces),
    [linearAttachmentWorkspaces]
  )
  const inAlfredLinkedLinearRefs = useMemo(
    () =>
      collectLinkedLinearIssueRefsFromWorktrees(linearAttachmentWorkspaces, {
        workspaceId: selectedLinearWorkspaceId,
        workspaces: linearStatus.workspaces ?? []
      }),
    [linearAttachmentWorkspaces, linearStatus.workspaces, selectedLinearWorkspaceId]
  )
  const inAlfredLinkedLinearRefsSignature = useMemo(
    () => linkedLinearIssueRefsSignature(inAlfredLinkedLinearRefs),
    [inAlfredLinkedLinearRefs]
  )
  const inAlfredLinkedLinearRefsRef = useRef(inAlfredLinkedLinearRefs)
  // Keep latest linked refs for the in-alfred loader without re-running it on identity churn.
  useEffect(() => {
    inAlfredLinkedLinearRefsRef.current = inAlfredLinkedLinearRefs
  }, [inAlfredLinkedLinearRefs])
  return Object.assign(model, {
    linearAttributePrimaryTeam,
    applyLinearAttributeFilter,
    linearSearchActive,
    showLinearAttributeFilters,
    linearAttachmentWorkspaces,
    linearIssueAttachmentIndex,
    inAlfredLinkedLinearRefs,
    inAlfredLinkedLinearRefsSignature,
    inAlfredLinkedLinearRefsRef
  })
}
export type TaskPageLinearFilterSelectionModel = ReturnType<typeof useTaskPageLinearFilterSelection>
