import { join } from 'node:path'
import { runProcess } from '../../src/shared/child-process/run-process'
import { MOBILE_WEB_BUNDLE_CAPABILITY } from '../../src/shared/mobile-web-bundle/mobile-web-bundle-capability'

// Deterministic execution backend: real Node command/file effect, no agent account or user workspace.
export function mobileWebJourneyTestRuntime(directory, clientId = 'native-client-1') {
  const workspace = {
    workspaceKind: 'folder-workspace',
    worktreeId: 'folder:test',
    repoId: 'test-project',
    repo: 'Relay workspace',
    branch: '',
    displayName: 'Relay workspace',
    path: directory,
    liveTerminalCount: 1,
    hasAttachedPty: true,
    preview: '',
    unread: false,
    isPinned: false,
    linkedPR: null,
    status: 'active'
  }
  const terminal = { handle: 'term_test', title: 'Test shell', isActive: true, connected: true }
  const tabs = {
    worktree: 'folder:test',
    publicationEpoch: 'test:1',
    snapshotVersion: 1,
    tabs: [{ ...terminal, id: 'tab-1', type: 'terminal', terminal: terminal.handle }],
    activeTabId: 'tab-1',
    activeTabType: 'terminal'
  }
  const subscriptions = []
  const calls = []
  const marker = join(directory, 'action.txt')
  const projects = [
    { id: workspace.repoId, displayName: workspace.repo, path: directory, kind: 'folder' }
  ]
  const addedProjects = []
  let input = ''
  function publish(chunk) {
    for (const { request, reply } of subscriptions) {
      reply(success(request.id, { type: 'data', chunk }))
    }
  }
  function success(id, result) {
    return { id, ok: true, result, _meta: { runtimeId: 'test-runtime' } }
  }
  return {
    calls,
    addedProjects,
    marker,
    async dispatch(request, reply) {
      calls.push(request.method)
      let result = {}
      switch (request.method) {
        case 'status.get':
          result = {
            protocolVersion: 2,
            minCompatibleMobileVersion: 1,
            capabilities: ['mobile.tasks.v1', MOBILE_WEB_BUNDLE_CAPABILITY]
          }
          break
        case 'worktree.ps':
          result = { worktrees: [workspace], totalCount: 1, truncated: false }
          break
        case 'worktree.show':
          result = { worktree: { ...workspace, id: workspace.worktreeId } }
          break
        case 'repo.list':
          result = { repos: projects }
          break
        case 'files.browseServerDir': {
          const target = request.params.path
          const home = target === '~' || target === directory
          result = {
            resolvedPath: home ? directory : join(directory, 'web-added-project'),
            pathFlavor: 'posix',
            entries: home ? [{ name: 'web-added-project', isDirectory: true }] : []
          }
          break
        }
        case 'repo.add': {
          const project = { id: 'web-added', displayName: 'web-added-project', ...request.params }
          addedProjects.push(project)
          projects.push(project)
          result = { repo: project }
          break
        }
        case 'host.platform':
          result = { platform: process.platform }
          break
        case 'ssh.listTargetSummaries':
          result = { targets: [] }
          break
        case 'terminal.list':
          result = { terminals: [terminal] }
          break
        case 'session.tabs.list':
          result = tabs
          break
        case 'session.tabs.subscribe':
          reply(success(request.id, tabs))
          return
        case 'ui.get':
          result = { workspaceViewSettings: {}, terminalQuickCommands: [] }
          break
        case 'terminal.subscribe':
          if (request.params.client?.id !== clientId) {
            throw new Error('Terminal subscription lost the authenticated identity')
          }
          subscriptions.push({ request, reply })
          reply(success(request.id, { type: 'subscribed' }))
          reply(
            success(request.id, {
              type: 'scrollback',
              cols: 80,
              rows: 24,
              serialized: 'Relay test shell\r\n$ ',
              cwd: directory
            })
          )
          return
        case 'terminal.send': {
          if (request.params.client?.id !== clientId) {
            throw new Error('Terminal input lost the authenticated identity')
          }
          input += request.params.text ?? ''
          if (request.params.enter || input.includes('\r') || input.includes('\n')) {
            // Accept one bounded test command; never execute arbitrary page-provided shell text.
            if (input.trim() !== 'orca-ui-proof') {
              throw new Error(`Unexpected test command: ${JSON.stringify(input)}`)
            }
            const action = await runProcess({
              program: process.execPath,
              args: [
                '-e',
                "require('node:fs').writeFileSync(process.argv[1], 'relay action completed'); console.log('relay action completed')",
                marker
              ],
              env: { ...process.env, ORCA_BACKGROUND_LAUNCH: '1' }
            })
            if (action.code !== 0) {
              throw new Error(action.stderr)
            }
            publish(`\r\n${action.stdout}\r\n$ `)
            input = ''
          }
          result = { send: { accepted: true } }
          break
        }
        default:
          if (request.method.endsWith('.subscribe')) {
            return
          }
      }
      reply(success(request.id, result))
    }
  }
}
