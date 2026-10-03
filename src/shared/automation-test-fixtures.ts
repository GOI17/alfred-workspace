import type { Automation, AutomationRun } from './automations-types'

export function makeAutomation(overrides: Partial<Automation> = {}): Automation {
  return {
    id: 'a-1',
    name: 'Nightly',
    prompt: 'Run the nightly sweep',
    precheck: null,
    agentId: 'claude',
    runContext: null,
    projectId: 'repo-1',
    executionTargetType: 'local',
    executionTargetId: 'local',
    schedulerOwner: 'local_host_service',
    workspaceMode: 'new_per_run',
    workspaceId: null,
    baseBranch: null,
    reuseSession: false,
    timezone: 'UTC',
    rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
    dtstart: 1,
    enabled: true,
    nextRunAt: 2,
    missedRunPolicy: 'run_once_within_grace',
    missedRunGraceMinutes: 720,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

export function makeRun(overrides: Partial<AutomationRun> = {}): AutomationRun {
  return {
    id: 'run-1',
    automationId: 'a-1',
    title: 'Nightly #1',
    scheduledFor: 10,
    status: 'completed',
    trigger: 'scheduled',
    workspaceId: null,
    sessionKind: 'terminal',
    chatSessionId: null,
    terminalSessionId: null,
    terminalPaneKey: null,
    terminalPtyId: null,
    outputSnapshot: null,
    precheckResult: null,
    usage: null,
    error: null,
    startedAt: 10,
    dispatchedAt: 10,
    createdAt: 10,
    ...overrides
  }
}
