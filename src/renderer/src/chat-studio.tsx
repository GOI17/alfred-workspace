import { useState, type ComponentProps } from 'react'
import { ExternalLink } from 'lucide-react'
import { ChatPanel } from './chat-panel'
import { ChatDeck } from './chat-deck'
import { Button } from './components/ui/button'
import { useUI } from './ui-preferences'

export function ChatStudio(props: ComponentProps<typeof ChatPanel>) {
  return <ChatDeck key={props.conversation.id} conversation={props.conversation} conversations={props.state.conversations} render={(conversation) => <StudioContent {...props} conversation={conversation} agent={props.state.agents[conversation.id]} />} />
}

/** Only summarize recorded activity; notes are not evidence of saved files. */
function StudioContent(props: ComponentProps<typeof ChatPanel>) {
  const { t } = useUI()
  const [open, setOpen] = useState(true)
  const [popupBlocked, setPopupBlocked] = useState(false)
  const { conversation, agent } = props
  function openWindow() {
    const url = new URL(window.location.href)
    url.search = ''
    url.hash = ''
    url.searchParams.set('chatWindow', conversation.id)
    // Named windows avoid creating duplicates for repeated clicks on the same chat.
    const popup = window.open(url.href, `alfred-chat-${conversation.id}`, 'popup=yes,width=720,height=900,resizable=yes,scrollbars=yes')
    setPopupBlocked(!popup)
    popup?.focus()
  }
  const notes = conversation.messages.flatMap((message) => message.notes.map((text, index) => ({ text, key: `${message.id}:${index}` }))).slice(-30)
  return <div className="chat-studio" data-inspector-open={open}>
    <div className="studio-chat">
      <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
        <Button variant="ghost" size="small" onClick={openWindow} title={t('Open an independent browser window', 'Abrir una ventana independiente del navegador')}><ExternalLink size={15} />{t('Open in separate window', 'Abrir en ventana independiente')}</Button>
      </div>
      {popupBlocked && <p role="alert" className="error-text">{t('Allow pop-ups for Alfred and try again.', 'Permite las ventanas emergentes de Alfred y vuelve a intentarlo.')}</p>}
      <ChatPanel {...props} />
    </div>
    <aside className="studio-inspector" aria-label={t('Changes and activity', 'Cambios y actividad')}>
      <button className="studio-inspector-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>{t('Changes and activity', 'Cambios y actividad')} <span aria-hidden="true">{open ? '−' : '+'}</span></button>
      {open && <div className="studio-inspector-body">
        <h2>{t('Proposed changes', 'Cambios propuestos')}</h2>
        {agent?.approval ? <>
          <span className="badge">{t('Requires approval', 'Requiere aprobación')}</span>
          <p className="studio-approval-path">{agent.approval.path}</p>
          <p className="muted">{t('Review the exact content and approve or reject it in the conversation. Pending approval does not mean the change was saved.', 'Revisa el contenido exacto y aprueba o rechaza en la conversación. Una aprobación pendiente no significa que el cambio se haya guardado.')}</p>
        </> : <p className="muted">{t('No pending approvals. Inspect Git to see changes on disk.', 'Sin aprobaciones pendientes. Consulta Git para ver los cambios en disco.')}</p>}
        <h2>{t('Recorded activity', 'Actividad registrada')}</h2>
        <p className="muted">{t('Latest 30 entries. These are activity notes, not a verified file diff.', 'Últimas 30 entradas. Son notas de actividad, no un diff verificado de archivos.')}</p>
        {notes.length ? <ol className="studio-activity">{notes.map((note) => <li key={note.key}><details><summary>{note.text.slice(0, 100)}{note.text.length > 100 ? '…' : ''}</summary><p>{note.text}</p></details></li>)}</ol> : <p className="muted">{t('No activity recorded yet.', 'Todavía no hay actividad registrada.')}</p>}
      </div>}
    </aside>
  </div>
}
