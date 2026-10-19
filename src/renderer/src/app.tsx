import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, FolderPlus, GitBranch, Globe, Menu, MessageSquare, Plus, Smartphone, TerminalSquare, Columns2, Sparkles, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { Conversation, Layout, Worktree } from '../../shared/contracts'
import { panes } from '../../shared/contracts'
import { api, errorMessage } from './api'
import { useWorkspace } from './use-workspace'
import { panelId } from './panel-id'
import { Sidebar } from './sidebar'
import { PanelLayout, type ToolKind, type ToolVisibility } from './panel-layout'
import { WorktreeDialog, SettingsDialog } from './project-dialogs'
import { useProjectSelection } from './use-project-selection'
import { Button } from './components/ui/button'
import { Login, PhoneDialog, useTunnelStatus } from './device-connection'
import { Dialog } from './components/ui/dialog'
import './assets/workspace-chrome.css'

export function App() {
  const { state, authenticated, connected, refresh } = useWorkspace()
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 700px)').matches)
  useEffect(() => {
    const query = matchMedia('(max-width: 700px)')
    const update = () => setMobile(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  // Public tunnel requests may reach the backend over loopback; use the browser origin.
  const canConnectPhone = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname)
  const { tunnel, error: tunnelError } = useTunnelStatus(canConnectPhone && authenticated === true)
  const phoneLabel = tunnelError ? 'Could not verify the tunnel' : !tunnel ? 'Checking phone connection…' : tunnel.state === 'connected' ? 'Phone: tunnel connected' : tunnel.state === 'connecting' ? 'Phone: connecting…' : tunnel.state === 'stopping' ? 'Phone: disconnecting…' : tunnel.state === 'error' ? 'Phone: connection error' : tunnel.state === 'disabled' ? 'Set up phone connection' : 'Connect phone'
  const [projectId, setProjectId] = useState(localStorage.getItem('alfred.project') || '')
  const [conversationId, setConversationId] = useState(localStorage.getItem('alfred.conversation') || '')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(localStorage.getItem('alfred.sidebarCollapsed') === 'true')
  const [workspacePath, setWorkspacePath] = useState(''), [worktrees, setWorktrees] = useState<Worktree[]>([]), [treeVersion, setTreeVersion] = useState(0)
  const [dialog, setDialog] = useState<'worktree' | 'settings' | 'phone' | null>(null), [mobileOpen, setMobileOpen] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const { selecting, select } = useProjectSelection(async (item) => {
    await refresh(); setProjectId(item.id); setWorkspacePath(item.path); setConversationId('')
  }, setError)
  function addProject() { setMobileOpen(false); void select() }
  const [activePane, setActivePane] = useState('')
  const [toolStates, setToolStates] = useState<Record<string, { visible: ToolVisibility; maximized: ToolKind | null }>>({})
  const tools = toolStates[conversationId] || { visible: { terminal: false, browser: false, git: false }, maximized: null }
  const [confirmation, setConfirmation] = useState<{ title: string; description: string; perform: () => Promise<void> }>()
  const project = state?.projects.find((item) => item.id === projectId)
  const conversation = state?.conversations.find((item) => item.id === conversationId && item.projectId === projectId && item.workspacePath === workspacePath)
  useEffect(() => { localStorage.setItem('alfred.sidebarCollapsed', String(sidebarCollapsed)) }, [sidebarCollapsed])
  useEffect(() => {
    if (state && !state.projects.some((item) => item.id === projectId)) setProjectId(state.projects[0]?.id || '')
  }, [state, projectId])
  useEffect(() => {
    if (!project) { setWorktrees([]); return }
    let current = true
    setWorktrees([])
    void api<Worktree[]>(`/projects/${project.id}/worktrees`).then((trees) => {
      if (!current) return
      setWorktrees(trees)
      const remembered = state?.conversations.find((item) => item.id === conversationId && item.projectId === project.id)?.workspacePath
      setWorkspacePath((previous) => trees.some((tree) => tree.path === previous) ? previous : remembered && trees.some((tree) => tree.path === remembered) ? remembered : project.path)
    }).catch((error) => { if (current) setError(errorMessage(error)) })
    return () => { current = false }
  }, [project?.id, treeVersion, state?.worktreeVersion])
  useEffect(() => {
    localStorage.setItem('alfred.project', projectId); localStorage.setItem('alfred.conversation', conversationId)
  }, [projectId, conversationId])
  const execute = useCallback(async (action: () => Promise<void>) => {
    setError(''); setBusy(true)
    try { await action() } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
  }, [])
  async function newConversation(path = workspacePath) {
    if (!project) return
    await execute(async () => {
      const next = await api<Conversation>('/conversations', { projectId, workspacePath: path || project.path })
      await refresh(); setWorkspacePath(next.workspacePath); setConversationId(next.id); setActivePane(panes(next.layout)[0].id); setMobileOpen(false)
    })
  }
  function updateLayout(layout: Layout) {
    if (conversation) void execute(async () => { await api(`/conversations/${conversation.id}/layout`, layout, 'PUT'); await refresh() })
  }
  function showTool(kind: ToolKind, shown: boolean) {
    setToolStates((previous) => {
      const current = previous[conversationId] || { visible: { terminal: false, browser: false, git: false }, maximized: null }
      return { ...previous, [conversationId]: { visible: { ...current.visible, [kind]: shown }, maximized: current.maximized === kind && !shown ? null : current.maximized } }
    })
  }
  function addTool(kind: ToolKind) {
    if (!conversation || busy || (mobile && kind !== 'git') || panes(conversation.layout).length >= 8) return
    const id = conversation.id
    const next = { type: 'pane' as const, id: panelId(), kind }
    const layout: Layout = { type: 'split', id: panelId(), direction: kind === 'terminal' ? 'column' : 'row', ratio: 0.5, children: [conversation.layout, next] }
    void execute(async () => {
      await api(`/conversations/${id}/layout`, layout, 'PUT')
      await refresh()
      setActivePane(next.id)
      showTool(kind, true)
    })
  }
  function toggleTool(kind: ToolKind) {
    if (!conversation) return
    if (panes(conversation.layout).some((pane) => pane.kind === kind)) showTool(kind, !tools.visible[kind])
    else addTool(kind)
  }
  function maximizeTool(kind: ToolKind) {
    setToolStates((previous) => {
      const current = previous[conversationId] || tools
      return { ...previous, [conversationId]: { ...current, maximized: current.maximized === kind ? null : kind } }
    })
  }
  useEffect(() => {
    let prefix = false, timer: ReturnType<typeof setTimeout>
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'b') {
        event.preventDefault(); prefix = true; clearTimeout(timer); timer = setTimeout(() => { prefix = false }, 1500); return
      }
      if (!prefix) return
      prefix = false
      if (event.key === '%' || event.key === '"') { event.preventDefault(); addTool('terminal') }
      if (event.key === 'c') { event.preventDefault(); void newConversation() }
      if (event.key === 'o' && conversation) {
        event.preventDefault()
        const leaves = panes(conversation.layout).filter((pane) => !mobile || pane.kind === 'chat' || pane.kind === 'git'), current = leaves.findIndex((pane) => pane.id === activePane)
        const next = leaves[(current + 1) % leaves.length]
        setActivePane(next.id)
        if (next.kind !== 'chat') showTool(next.kind, true)
        setToolStates((previous) => ({ ...previous, [conversationId]: { ...(previous[conversationId] || tools), maximized: null } }))
        requestAnimationFrame(() => document.querySelector(`[data-pane-id="${next.id}"]`)?.querySelector<HTMLElement>('textarea, input, [tabindex="0"]')?.focus())
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => { clearTimeout(timer); window.removeEventListener('keydown', handler, true) }
  }, [conversation, activePane, projectId, workspacePath, busy, tools, mobile])
  if (authenticated === undefined) return <div className="loading-screen"><span className="brand-mark">a·</span><p>Opening your workspace…</p></div>
  if (!authenticated || !state) return <Login connected={refresh} />
  return <div className="app-shell" data-sidebar-collapsed={sidebarCollapsed}>
    <div id="workspace-sidebar" className="workspace-sidebar-container">
      <Sidebar state={state} project={project} conversation={conversation} worktrees={worktrees} workspacePath={workspacePath} connected={connected} mobileOpen={mobileOpen}
        close={() => setMobileOpen(false)} selectProject={(id) => { setProjectId(id); setWorkspacePath(''); setConversationId('') }}
        selectWorkspace={(path) => { setWorkspacePath(path); setConversationId(state.conversations.find((item) => item.projectId === projectId && item.workspacePath === path)?.id || '') }}
        selectConversation={(id) => { setConversationId(id); setMobileOpen(false) }} addProject={addProject} addConversation={() => void newConversation()}
        addWorktree={() => setDialog('worktree')} settings={() => setDialog('settings')}
        removeProject={() => { if (project) setConfirmation({ title: `Remove ${project.name}`, description: 'Its conversations will be removed from Alfred and its sessions closed. The folder, files, and worktrees will remain on disk.', perform: async () => { await api(`/projects/${project.id}`, undefined, 'DELETE'); await refresh() } }) }}
        removeConversation={(id) => setConfirmation({ title: 'Delete conversation', description: 'This conversation history will be deleted and its panels and sessions closed.', perform: async () => { await api(`/conversations/${id}`, undefined, 'DELETE'); await refresh() } })}
        removeWorktree={(path) => setConfirmation({ title: 'Delete worktree', description: 'Git will delete this worktree folder and Alfred will close its conversations. The operation will be rejected if there are uncommitted changes. The branch will be preserved.', perform: async () => { await api(`/projects/${projectId}/worktrees`, { path }, 'DELETE'); setTreeVersion((value) => value + 1); await refresh() } })}
      />
    </div>
    <main className="main-workspace">
      <header className="workspace-header workspace-header-unified">
        <span className="desktop-sidebar-toggle"><Button variant="ghost" size="icon" aria-controls="workspace-sidebar" aria-expanded={!sidebarCollapsed} aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'} title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'} onClick={() => setSidebarCollapsed((value) => !value)}>{sidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</Button></span>
        <span className="mobile-only"><Button variant="ghost" size="icon" aria-label="Open workspaces" aria-controls="workspace-sidebar" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={19} /></Button></span>
        <div className="workspace-heading-context">
          <div className="workspace-breadcrumb"><span className="breadcrumb-project" title={project?.name}>{project?.name || 'Welcome to Alfred'}</span>{project && <><span className="breadcrumb-slash">/</span><GitBranch size={13} /><span className="breadcrumb-branch" title={workspacePath}>{worktrees.find((tree) => tree.path === workspacePath)?.branch || 'Workspace'}</span></>}</div>
          {conversation && <div className="conversation-title"><span title={conversation.title}>{conversation.title}</span></div>}
        </div>
        <div className="panel-tools">
          {conversation && (['terminal', 'browser', 'git'] as const).filter((kind) => !mobile || kind === 'git').map((kind) => {
            const label = kind === 'terminal' ? 'Terminal' : kind === 'browser' ? 'Browser' : 'Git'
            const Icon = kind === 'terminal' ? TerminalSquare : kind === 'browser' ? Globe : GitBranch
            const exists = panes(conversation.layout).some((pane) => pane.kind === kind)
            const shown = exists && tools.visible[kind]
            return <Button key={kind} variant="ghost" size="small" disabled={busy || (!exists && panes(conversation.layout).length >= 8) || (kind === 'git' && project?.kind !== 'git')} onClick={() => toggleTool(kind)} aria-label={label} aria-pressed={shown} title={`${shown ? 'Hide' : 'Show'} ${label}`}><Icon size={15} /><span>{label}</span></Button>
          })}
          {canConnectPhone && <Button variant="ghost" size="small" onClick={() => setDialog('phone')} aria-label={phoneLabel} title={phoneLabel}><Smartphone size={17} /><span>{tunnel?.state === 'connected' && !tunnelError ? 'Connected' : ''}</span></Button>}
        </div>
      </header>
      {error && <div className="app-error" role="alert"><span>{error}</span><Button variant="ghost" size="small" onClick={() => setError('')}>Close</Button></div>}
      {selecting && <div className="connection-banner" role="status">Select a folder in the system dialog…</div>}
      {!connected && <div className="connection-banner" role="status">Disconnected from the server. Agent status cannot be verified.</div>}
      {conversation ? <PanelLayout mobile={mobile} key={conversation.id} conversation={conversation} state={state} active={activePane} setActive={setActivePane} update={updateLayout} settings={() => setDialog('settings')} visible={tools.visible} toggle={toggleTool} maximized={tools.maximized && (!mobile || tools.maximized === 'git') && panes(conversation.layout).some((pane) => pane.kind === tools.maximized) ? tools.maximized : null} maximize={maximizeTool} addTerminal={() => addTool('terminal')} busy={busy} />
        : <div className="start-screen">
          <div className="start-orbit"><span className="brand-mark">a<span>·</span></span><span className="orbit-symbol orbit-one"><MessageSquare size={20} /></span><span className="orbit-symbol orbit-two"><GitBranch size={20} /></span><span className="orbit-symbol orbit-three"><TerminalSquare size={20} /></span></div>
          <p className="eyebrow">LESS NOISE. MORE SPACE.</p><h1>{project ? 'Your next step starts here.' : 'A place for your ideas.'}</h1>
          <p>{project ? 'A conversation, your tools, and all your project context.' : 'Your projects, conversations, and tools.\nOn your computer. With you wherever you are.'}</p>
          <Button onClick={() => project ? void newConversation() : addProject()} disabled={busy || selecting}>{project ? <Plus size={17} /> : <FolderPlus size={17} />}{project ? 'New conversation' : 'Add my first project'}<ArrowUpRight size={16} /></Button>
          <div className="start-features"><span><Sparkles size={15} />Native chat</span><span><Columns2 size={15} />Your own workspace</span><span><Smartphone size={15} />Wherever you are</span></div>
        </div>}
    </main>
    {dialog === 'worktree' && project && <WorktreeDialog project={project} onClose={() => setDialog(null)} onAdded={(path) => { setTreeVersion((value) => value + 1); setWorkspacePath(path); void newConversation(path) }} />}
    {dialog === 'settings' && <SettingsDialog state={state} onClose={() => setDialog(null)} />}
    {canConnectPhone && dialog === 'phone' && <PhoneDialog onClose={() => setDialog(null)} />}
    {confirmation && <Dialog open onClose={() => setConfirmation(undefined)} title={confirmation.title} description={confirmation.description}><div className="dialog-actions"><Button variant="secondary" onClick={() => setConfirmation(undefined)}>Cancel</Button><Button variant="danger" disabled={busy} onClick={() => void execute(async () => { await confirmation.perform(); setConfirmation(undefined) })}>{busy ? 'Deleting…' : 'Confirm deletion'}</Button></div></Dialog>}
  </div>
}
