import type { JiraIssue } from './jira-types'
export function makeJiraIssue(overrides: Partial<JiraIssue> = {}): JiraIssue {
  return {
    id: '100',
    key: 'ALFRED-123',
    siteId: 'cloud',
    title: 'Link Jira',
    url: 'https://company.atlassian.net/browse/ALFRED-123',
    project: { id: '10', key: 'ALFRED', name: 'Alfred' },
    issueType: { id: '1', name: 'Task' },
    status: { id: '1', name: 'Open', categoryKey: 'new', categoryName: 'To Do' },
    labels: [],
    updatedAt: '2026-07-27T00:00:00.000Z',
    createdAt: '2026-07-27T00:00:00.000Z',
    ...overrides
  }
}
