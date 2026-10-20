import { useRef, useState, type ReactNode } from 'react'
import { Columns2, PanelTop, X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Conversation } from '../../shared/contracts'
import { Button } from './components/ui/button'
import { useUI } from './ui-preferences'
import './assets/chat-deck.css'

/** Layout is local to this view. Closing a column never deletes a conversation. */
export function ChatDeck({ conversation, conversations, render }: {
  conversation: Conversation
  conversations: Conversation[]
  render: (conversation: Conversation) => ReactNode
}) {
  const { t } = useUI()
  const [ids, setIds] = useState<string[]>([])
  const [floating, setFloating] = useState<string | null>(null)
  const [focused, setFocused] = useState(conversation.id)
  const [position, setPosition] = useState({ x: 16, y: 56 })
  const root = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const available = conversations.filter((item) => item.projectId === conversation.projectId && item.workspacePath === conversation.workspacePath && item.id !== conversation.id)
  const chats = [conversation, ...ids.flatMap((id) => available.find((item) => item.id === id) || [])]
  const active = chats.some((item) => item.id === focused) ? focused : conversation.id
  function reveal(id: string) {
    setFocused(id)
    requestAnimationFrame(() => {
      const column = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-chat-column]') || []).find((item) => item.dataset.chatColumn === id)
      column?.scrollIntoView({ block: 'nearest', inline: 'center' })
      column?.querySelector<HTMLElement>('.chat-column-title')?.focus()
    })
  }
  function move(x: number, y: number) {
    const bounds = root.current?.getBoundingClientRect()
    const window = root.current?.querySelector<HTMLElement>('[data-floating="true"]')
    setPosition({ x: Math.max(0, Math.min(x, (bounds?.width || 0) - (window?.offsetWidth || 0))), y: Math.max(48, Math.min(y, (bounds?.height || 0) - (window?.offsetHeight || 0))) })
  }
  return <div className="chat-deck" ref={root}>
    <div className="chat-deck-toolbar" aria-label={t('Chat layout', 'Disposición de chats')}>
      <Columns2 size={16} aria-hidden="true" />
      <select aria-label={t('Add chat column', 'Agregar columna de chat')} value="" onChange={(event) => {
        const id = event.target.value
        if (!id) return
        setIds((current) => [...current, id]); reveal(id)
      }}>
        <option value="">{t('Add chat…', 'Agregar chat…')}</option>
        {available.filter((item) => !ids.includes(item.id)).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
      <Button variant="ghost" size="icon" aria-label={t('Previous chat', 'Chat anterior')} disabled={chats.length < 2} onClick={() => reveal(chats[(chats.findIndex((item) => item.id === active) + chats.length - 1) % chats.length].id)}><ChevronLeft size={16} /></Button>
      <Button variant="ghost" size="icon" aria-label={t('Next chat', 'Chat siguiente')} disabled={chats.length < 2} onClick={() => reveal(chats[(chats.findIndex((item) => item.id === active) + 1) % chats.length].id)}><ChevronRight size={16} /></Button>
      <span className="chat-deck-count">{chats.length}</span>
    </div>
    <div className="chat-columns" data-multiple={chats.length > 1}>
      {chats.map((chat) => <section key={chat.id} className="chat-column" data-chat-column={chat.id} data-floating={floating === chat.id} data-focused={active === chat.id} aria-label={chat.title} style={floating === chat.id ? { left: position.x, top: position.y } : undefined} onFocusCapture={() => setFocused(chat.id)}>
        <div className="chat-column-heading">
          <button className="chat-column-title" title={floating === chat.id ? t('Drag to move; use arrow keys to reposition', 'Arrastra para mover; usa las flechas para reposicionar') : chat.title} onPointerDown={(event) => {
            if (floating !== chat.id || event.button !== 0) return
            drag.current = { x: event.clientX, y: event.clientY, left: position.x, top: position.y }
            event.currentTarget.setPointerCapture(event.pointerId)
          }} onPointerMove={(event) => {
            if (drag.current) move(drag.current.left + event.clientX - drag.current.x, drag.current.top + event.clientY - drag.current.y)
          }} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }} onKeyDown={(event) => {
            if (floating !== chat.id || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
            event.preventDefault()
            move(position.x + (event.key === 'ArrowLeft' ? -20 : event.key === 'ArrowRight' ? 20 : 0), position.y + (event.key === 'ArrowUp' ? -20 : event.key === 'ArrowDown' ? 20 : 0))
          }}>{chat.title}</button>
          <span className="chat-float-control"><Button variant="ghost" size="icon" aria-label={floating === chat.id ? t('Dock chat', 'Acoplar chat') : t('Float chat', 'Hacer flotante el chat')} title={floating === chat.id ? t('Dock chat', 'Acoplar chat') : t('Float chat', 'Hacer flotante el chat')} aria-pressed={floating === chat.id} onClick={() => { setFloating(floating === chat.id ? null : chat.id); setPosition({ x: 16, y: 56 }) }}><PanelTop size={15} /></Button></span>
          {chat.id !== conversation.id && <Button variant="ghost" size="icon" aria-label={`${t('Close column', 'Cerrar columna')}: ${chat.title}`} onClick={() => {
            setIds((current) => current.filter((id) => id !== chat.id))
            if (floating === chat.id) setFloating(null)
            reveal(conversation.id)
          }}><X size={15} /></Button>}
        </div>
        <div className="chat-column-body">{render(chat)}</div>
      </section>)}
    </div>
  </div>
}
