import { makeWorktree } from '../../../../shared/worktree/worktree-test-fixture'
export { makeWorktree } from '../../../../shared/worktree/worktree-test-fixture'
import { makeAutomation } from '../../../../shared/automation-test-fixtures'
export { makeAutomation, makeRun } from '../../../../shared/automation-test-fixtures'
/**
 * Fixtures for the automations page characterization tests.
 *
 * The automation defaults are deliberately the *runnable* shape — a local record
 * whose repo has no SSH connection — so Run Now reaches its handler instead of
 * being refused by the availability gate. Tests that need an unrunnable record
 * override the fields they care about.
 */

import type {
  AutomationRunUsage,
  ExternalAutomationManager
} from '../../../../shared/automations-types'
import type { ProjectHostSetup } from '../../../../shared/project-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import type {
  ExternalAutomationScope,
  ScopedExternalAutomationManager
} from './external-automation-scope-client'
import { automationListRowKey, type AutomationListRow } from './automation-list-row-identity'
import { ALL_AUTOMATION_HOSTS_FILTER } from '../../../../shared/automation-host-filter'
import { getDefaultSettings } from '../../../../shared/constants'

export const REPO_ID = 'repo-1'
export const WORKSPACE_ID = 'workspace-1'

/** A list row for a record on a given host; the host defaults to the desktop. */
export function makeAutomationListRow(
  overrides: Partial<AutomationListRow> & { hostStableKey?: string } = {}
): AutomationListRow {
  const automation = overrides.automation ?? makeAutomation()
  const hostStableKey = overrides.hostStableKey ?? 'host:desktop:self'
  return {
    key: overrides.key ?? automationListRowKey(hostStableKey, automation.id),
    automation,
    hostLabel: overrides.hostLabel ?? 'This computer',
    usageSummary: overrides.usageSummary ?? null
  }
}

export function makeRunUsage(overrides: Partial<AutomationRunUsage> = {}): AutomationRunUsage {
  return {
    status: 'known',
    provider: 'claude',
    model: 'claude-opus-5',
    inputTokens: 1_000,
    outputTokens: 500,
    cacheReadTokens: null,
    cacheWriteTokens: null,
    reasoningOutputTokens: null,
    totalTokens: 1_500,
    estimatedCostUsd: 0.25,
    estimatedCostSource: 'api_equivalent',
    providerSessionId: 'session-1',
    attribution: 'provider_session_time_window',
    collectedAt: 10,
    unavailableReason: null,
    unavailableMessage: null,
    ...overrides
  }
}

export function makeExternalManager(
  overrides: Partial<ExternalAutomationManager> = {}
): ExternalAutomationManager {
  return {
    id: 'hermes:local',
    provider: 'hermes',
    label: 'Hermes',
    targetLabel: 'This computer',
    target: { type: 'local' },
    status: 'available',
    error: null,
    canManage: true,
    jobs: [
      {
        id: 'job-1',
        managerId: 'hermes:local',
        provider: 'hermes',
        name: 'Hermes job',
        schedule: 'Daily at 09:00',
        rawSchedule: '0 9 * * *',
        enabled: true,
        state: 'active',
        prompt: null,
        promptPreview: 'Sweep',
        nextRunAt: null,
        lastRunAt: null,
        lastStatus: null,
        lastError: null,
        workdir: null,
        runCount: 0,
        runs: []
      }
    ],
    ...overrides
  }
}

/** The desktop-self scope every manager fixture is discovered under by default. */
export function makeExternalAutomationScope(
  overrides: Partial<ExternalAutomationScope> = {}
): ExternalAutomationScope {
  return {
    owner: {
      authority: { kind: 'desktop' },
      selector: { kind: 'self' }
    },
    provider: 'hermes',
    ...overrides
  }
}

export function makeScopedExternalManager(
  overrides: Partial<ExternalAutomationManager> = {},
  scope: ExternalAutomationScope = makeExternalAutomationScope()
): ScopedExternalAutomationManager {
  return { scope, manager: makeExternalManager(overrides) }
}

function makeRepo(): Repo {
  return {
    id: REPO_ID,
    displayName: 'alfred',
    path: '/repos/alfred',
    badgeColor: '#000000',
    addedAt: 1,
    worktreeBaseRef: 'main'
  }
}

/** Ready and local, so the editor can build a run context and state a Self destination. */
function makeProjectHostSetup(): ProjectHostSetup {
  return {
    id: 'setup-1',
    projectId: 'project-1',
    hostId: 'local',
    repoId: REPO_ID,
    path: '/repos/alfred',
    displayName: 'alfred',
    setupState: 'ready',
    setupMethod: 'legacy-repo',
    createdAt: 1,
    updatedAt: 1
  }
}

export type AutomationsPageStoreFixtures = {
  state: Record<string, unknown>
  repoMap: Map<string, Repo>
  worktreeMap: Map<string, Worktree>
}

/** A store shaped like the page's reads; actions are spies so nothing escapes the test. */
export function makeStoreState(): AutomationsPageStoreFixtures {
  const repo = makeRepo()
  const worktree = makeWorktree()
  const noop = (): void => undefined
  return {
    state: {
      repos: [repo],
      projectHostSetups: [makeProjectHostSetup()],
      worktreesByRepo: { [REPO_ID]: [worktree] },
      unifiedTabsByWorktree: {},
      terminalLayoutsByTabId: {},
      ptyIdsByTabId: {},
      activeWorktreeId: null,
      fetchWorktrees: noop,
      fetchAllWorktrees: noop,
      fetchRuntimeEnvironmentRepos: async () => [],
      startupWorktreeRefreshCompleted: true,
      updateSettings: noop,
      openSettingsPage: noop,
      openSettingsTarget: noop,
      closeAutomationsPage: noop,
      activeModal: 'none',
      sshConnectionStates: new Map(),
      sshTargetLabels: new Map(),
      removedSshTargetLabels: new Map(),
      // Hydrated with no targets: the desktop authority has looked and has none,
      // so the catalog projects Desktop + Self and nothing else.
      sshTargetsHydrated: true,
      sshStateByEnvironment: new Map(),
      runtimeEnvironments: [],
      runtimeEnvironmentCatalogSettled: true,
      runtimeStatusByEnvironmentId: new Map(),
      automationHostFilter: ALL_AUTOMATION_HOSTS_FILTER,
      setAutomationHostFilter: noop,
      settings: getDefaultSettings('/tmp'),
      preflightStatus: null,
      preflightStatusChecked: true,
      preflightStatusContextKey: null,
      refreshPreflightStatus: noop,
      selectedAutomationId: null,
      setSelectedAutomationId: noop,
      pendingAutomationRunNavigation: null,
      setPendingAutomationRunNavigation: noop,
      hydratePersistedUI: noop,
      recordFeatureInteraction: noop,
      allWorktrees: () => [worktree],
      getKnownWorktreeById: () => worktree
    },
    repoMap: new Map([[REPO_ID, repo]]),
    worktreeMap: new Map([[WORKSPACE_ID, worktree]])
  }
}
