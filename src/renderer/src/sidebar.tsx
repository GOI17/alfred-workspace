import { useEffect, useState } from 'react'
import {
  Folder,
  FolderPlus,
  GitBranch,
  Plus,
  Settings2,
  X,
  PanelLeftClose,
  ChevronDown,
} from 'lucide-react'
import type { Conversation, Project, PublicState, Worktree } from '../../shared/contracts'
import { Button } from './components/ui/button'
import { ProviderLogo } from './components/provider-logo'
import { ProjectActions } from './components/project-actions'
import './assets/spaces.css'

export function Sidebar({
  state,
  project,
  conversation,
  worktrees,
  workspacePath,
  connected,
  mobileOpen,
  selectProject,
  selectConversation,
  selectWorkspace,
  addProject,
  addConversation,
  addWorktree,
  removeProject,
  removeConversation,
  removeWorktree,
  settings,
  close,
}: {
  state: PublicState
  project?: Project
  conversation?: Conversation
  worktrees: Worktree[]
  workspacePath: string
  connected: boolean
  mobileOpen: boolean
  selectProject: (id: string) => void
  selectConversation: (id: string) => void
  selectWorkspace: (path: string) => void
  addProject: () => void
  addConversation: () => void
  addWorktree: () => void
  removeProject: () => void
  removeConversation: (id: string) => void
  removeWorktree: (path: string) => void
  settings: () => void
  close: () => void
}) {
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 700px)').matches)
  useEffect(() => {
    const query = matchMedia('(max-width: 700px)')
    const update = () => setMobile(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const conversations = state.conversations.filter(
    (item) => item.projectId === project?.id && item.workspacePath === workspacePath,
  )
  const activeWorkspace = worktrees.find((tree) => tree.path === workspacePath)
  return (
    <>
      <button
        className="sidebar-scrim"
        data-open={mobileOpen}
        aria-label="Close sidebar"
        onClick={close}
      />
      <aside
        className="sidebar"
        data-open={mobileOpen}
        inert={mobile && !mobileOpen}
        aria-hidden={mobile && !mobileOpen}
      >
        <div className="brand">
          <span>alfred</span>
          <span className="mobile-only">
            <Button variant="ghost" size="icon" onClick={close} aria-label="Close sidebar">
              <PanelLeftClose size={18} />
            </Button>
          </span>
        </div>
        <div className="space-content" key={project?.id || 'empty'}>
          {project ? (
            <>
              <div className="project-heading">
                <span title={project.name}>{project.name}</span>
                <ProjectActions removeProject={removeProject} />
              </div>
              <details className="workspace-picker" key={`${project.id}:${workspacePath}`}>
                <summary title={workspacePath}>
                  <GitBranch size={14} />
                  <span>
                    {activeWorkspace?.branch ||
                      (workspacePath === project.path ? 'Main' : 'Active workspace')}
                  </span>
                  <ChevronDown size={14} />
                </summary>
                <div className="workspace-list" role="group" aria-label="Workspaces">
                  {worktrees.map((tree) => (
                    <div
                      key={tree.path}
                      className="workspace-row"
                      data-active={workspacePath === tree.path}
                    >
                      <button
                        aria-pressed={workspacePath === tree.path}
                        onClick={(event) => {
                          event.currentTarget.closest('details')?.removeAttribute('open')
                          selectWorkspace(tree.path)
                        }}
                        title={tree.path}
                      >
                        <GitBranch size={14} />
                        <span>{tree.branch}</span>
                        {tree.main && <span className="tiny-label">main</span>}
                      </button>
                      {!tree.main && tree.path !== project.path && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete worktree ${tree.branch}`}
                          onClick={() => removeWorktree(tree.path)}
                        >
                          <X size={13} />
                        </Button>
                      )}
                    </div>
                  ))}
                  {project.kind === 'git' && (
                    <button className="sidebar-text-button" onClick={addWorktree}>
                      <Plus size={14} />
                      New worktree
                    </button>
                  )}
                </div>
              </details>
              <div className="spaces-heading">
                <span>Conversations</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="New conversation"
                  title="New conversation"
                  onClick={addConversation}
                >
                  <Plus size={17} />
                </Button>
              </div>
              <nav className="conversation-list" aria-label="Conversations">
                {conversations.map((item) => (
                  <div
                    key={item.id}
                    className="conversation-row"
                    data-active={conversation?.id === item.id}
                  >
                    <button
                      onClick={() => selectConversation(item.id)}
                      aria-current={conversation?.id === item.id ? 'page' : undefined}
                      title={item.title}
                    >
                      <ProviderLogo provider={item.lastProvider} />
                      <span>{item.title}</span>
                      <span
                        className="status-dot"
                        data-status={
                          connected ? state.agents[item.id]?.status || 'idle' : 'offline'
                        }
                        title={
                          connected
                            ? state.agents[item.id]?.status || 'Available'
                            : 'Offline: status unavailable'
                        }
                      />
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeConversation(item.id)}
                      aria-label={`Delete conversation ${item.title}`}
                    >
                      <X size={13} />
                    </Button>
                  </div>
                ))}
                {!conversations.length && <p className="sidebar-empty">No conversations yet.</p>}
              </nav>
            </>
          ) : (
            <button className="project-item" onClick={addProject}>
              <FolderPlus size={18} />
              <span>Your first project</span>
            </button>
          )}
        </div>
        {!connected && (
          <p className="sidebar-connection" role="status">
            Reconnecting…
          </p>
        )}
        <div className="space-dock">
          <nav className="space-switcher" aria-label="Projects">
            {state.projects.map((item) => (
              <button
                key={item.id}
                className="space-icon"
                data-active={project?.id === item.id}
                aria-pressed={project?.id === item.id}
                aria-label={item.name}
                title={item.name}
                onClick={() => {
                  if (project?.id !== item.id) selectProject(item.id)
                }}
              >
                {item.kind === 'git' ? <GitBranch size={19} /> : <Folder size={19} />}
                <span className="space-initial" aria-hidden="true">
                  {item.name.slice(0, 1).toUpperCase()}
                </span>
                {connected &&
                  state.conversations.some(
                    (chat) =>
                      chat.projectId === item.id && state.agents[chat.id]?.status === 'running',
                  ) && <span className="status-dot" data-status="running" />}
              </button>
            ))}
          </nav>
          <button
            className="space-icon"
            onClick={addProject}
            aria-label="Add project"
            title="Add project"
          >
            <Plus size={19} />
          </button>
          <button className="space-icon" onClick={settings} aria-label="Settings" title="Settings">
            <Settings2 size={18} />
          </button>
        </div>
      </aside>
    </>
  )
}
