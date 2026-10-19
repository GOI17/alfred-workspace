import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft } from 'lucide-react'
import type { PublicState } from '../../shared/contracts'
import { AgentAccessSettings } from './agent-access-settings'
import { Button } from './components/ui/button'
import { Select } from './components/ui/input'
import './assets/settings-screen.css'

/** A full-page settings view. Keep the workspace mounted to preserve panel sessions. */
export function SettingsScreen({
  state,
  onClose,
  children,
}: {
  state: PublicState
  onClose: () => void
  children: ReactNode
}) {
  const [section, setSection] = useState<'models' | 'access'>('models')
  const [conversationId, setConversationId] = useState(
    () => localStorage.getItem('alfred.conversation') || '',
  )
  const heading = useRef<HTMLHeadingElement>(null)
  const conversation = state.conversations.find((item) => item.id === conversationId)
  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const workspace = document.querySelector<HTMLElement>('.app-shell')
    const wasInert = workspace?.inert ?? false
    if (workspace) workspace.inert = true
    heading.current?.focus()
    return () => {
      if (workspace) workspace.inert = wasInert
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])
  return createPortal(
    <main className="settings-screen" aria-labelledby="settings-title">
      <header className="settings-screen-header">
        <Button variant="ghost" onClick={onClose}>
          <ArrowLeft size={18} />
          Back to workspace
        </Button>
        <h1 id="settings-title" ref={heading} tabIndex={-1}>
          Settings
        </h1>
      </header>
      <div className="settings-screen-layout">
        <nav className="settings-screen-nav" aria-label="Settings sections">
          <Button
            variant={section === 'models' ? 'secondary' : 'ghost'}
            aria-current={section === 'models' ? 'page' : undefined}
            onClick={() => setSection('models')}
          >
            Models and connections
          </Button>
          <Button
            variant={section === 'access' ? 'secondary' : 'ghost'}
            aria-current={section === 'access' ? 'page' : undefined}
            onClick={() => setSection('access')}
          >
            Terminal and MCP
          </Button>
        </nav>
        <div className="settings-screen-content">
          <section hidden={section !== 'models'} aria-labelledby="settings-models-title">
            <h2 id="settings-models-title">Models and connections</h2>
            <p>Connect your models. Keys are encrypted and stored only on the server.</p>
            {children}
          </section>
          <section hidden={section !== 'access'} aria-labelledby="settings-access-title">
            <h2 id="settings-access-title">Agent access</h2>
            <p>
              Terminal and MCP are configured per conversation, not globally. Select the
              conversation whose permissions you want to edit.
            </p>
            <label htmlFor="settings-conversation">Conversation</label>
            <Select
              id="settings-conversation"
              value={conversation?.id || ''}
              onChange={(event) => setConversationId(event.target.value)}
            >
              <option value="">Select a conversation</option>
              {state.conversations.map((item) => (
                <option key={item.id} value={item.id}>
                  {state.projects.find((project) => project.id === item.projectId)?.name ||
                    'Project'}{' '}
                  · {item.title}
                </option>
              ))}
            </Select>
            {conversation ? (
              <AgentAccessSettings key={conversation.id} conversationId={conversation.id} />
            ) : (
              <p role="status">
                {state.conversations.length
                  ? 'Select a conversation to configure its access.'
                  : 'Create a conversation in the workspace to configure Terminal and MCP.'}
              </p>
            )}
          </section>
        </div>
      </div>
    </main>,
    document.body,
  )
}
