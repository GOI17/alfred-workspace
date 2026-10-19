import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowUp, Square, Sparkles, FileCheck2, Check, X, Paperclip } from 'lucide-react'
import type { AgentState, Conversation, PublicState, ProviderId } from '../../shared/contracts'
import { attachmentMediaType, MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES, MAX_TOTAL_ATTACHMENT_BYTES, type Attachment } from '../../shared/attachments'
import { api, errorMessage } from './api'
import { Button } from './components/ui/button'
import { ComposerInput } from './composer-input'
import { ModelPicker } from './model-picker'
import { ContextPermissions } from './context-permissions'
import './assets/attachments.css'
import './assets/message-queue.css'

const Markdown = lazy(() => import('./message-markdown'))
type Props = { conversation: Conversation; state: PublicState; agent?: AgentState; settings: () => void }
export function ChatPanel(props: Props) {
  return <ConversationChat key={props.conversation.id} {...props} />
}
function ApprovalCard({ approval, conversationId, onError }: {
  approval: NonNullable<AgentState['approval']>; conversationId: string; onError: (message: string) => void
}) {
  const operation = /^(Connect MCP:|MCP:|Terminal:)/.test(approval.path)
  const [saving, setSaving] = useState(false)
  const lock = useRef(false)
  // The batch tool uses the existing approval transport; never infer permission
  // from preview content. Decisions always refer to this exact approval ID.
  let files: { path: string; content: string }[] | undefined
  if (/^Batch of \d+ file\(s\)$/.test(approval.path)) {
    try {
      const parsed: unknown = JSON.parse(approval.content)
      if (parsed && typeof parsed === 'object' && 'files' in parsed && Array.isArray(parsed.files) && parsed.files.length > 0 &&
        parsed.files.every((file: unknown) => file && typeof file === 'object' && 'path' in file && typeof file.path === 'string' && 'content' in file && typeof file.content === 'string')) {
        files = parsed.files as { path: string; content: string }[]
      }
    } catch { /* Fall back to the exact original preview. */ }
  }
  async function decide(accepted: boolean) {
    if (lock.current) return
    lock.current = true
    setSaving(true)
    try { await api(`/conversations/${conversationId}/approval`, { approvalId: approval.id, accepted }) }
    catch (error) { onError(errorMessage(error)) }
    finally { lock.current = false; setSaving(false) }
  }
  return <div className="approval-card">
    <div><FileCheck2 size={18} /><strong>{operation ? 'Authorize operation' : files ? 'Review changes' : 'Review change'}</strong></div>
    {files ? <>
      <p>Alfred proposes saving {files.length} file(s). This approval covers only the contents shown.</p>
      {files.map((file, index) => <details key={index}><summary><code>{file.path}</code> · View proposed content</summary><pre>{file.content}</pre></details>)}
      <p>Saving is not atomic: if a file fails, successfully saved files will be reported.</p>
    </> : <>
      <p>{operation ? 'Alfred requests authorization for' : 'Alfred proposes saving'} <code>{approval.path}</code></p>
      <details><summary>View proposed content</summary><pre>{approval.content}</pre></details>
    </>}
    {approval.path.startsWith('Connect MCP:') && <p>Authorize the connection for this conversation during the server session. Changing the configuration revokes this authorization. Tool calls retain their own permissions.</p>}
    <div className="approval-actions">
      <Button variant="secondary" size="small" disabled={saving} onClick={() => void decide(false)}><X size={14} />{files ? 'Reject all' : 'Reject'}</Button>
      <Button size="small" disabled={saving} onClick={() => void decide(true)}><Check size={14} />{operation ? 'Authorize' : files ? 'Approve and save all' : 'Save file'}</Button>
    </div>
  </div>
}
function ConversationChat({ conversation, state, agent, settings }: Props) {
  const [text, setText] = useState(() => sessionStorage.getItem(`alfred.draft.${conversation.id}`) || '')
  const [provider, setProvider] = useState<ProviderId>(conversation.lastProvider || state.providers[0]?.id || 'openai')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [queueAction, setQueueAction] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [reading, setReading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const readingLock = useRef(false)
  const sendLock = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const composer = useRef<HTMLFormElement>(null)
  const messageContent = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const follow = useRef(true)
  const busy = agent?.status === 'running' || agent?.status === 'waiting'
  const queue = conversation.queue || []
  const configured = state.providers.some((item) => item.id === provider)
  const canSend = !sending && !reading && !queueAction && (!!text.trim() || !!attachments.length)
  useEffect(() => { sessionStorage.setItem(`alfred.draft.${conversation.id}`, text) }, [conversation.id, text])
  function scrollToLatest() {
    const element = scroller.current
    if (element) element.scrollTop = element.scrollHeight
  }
  // Align before scroll events can mistake a layout change for scrolling away.
  useLayoutEffect(() => {
    if (follow.current) scrollToLatest()
  }, [conversation.messages, agent?.approval, agent?.status, queue, text, attachments, sending, error])
  useLayoutEffect(() => {
    const element = scroller.current
    const content = messageContent.current
    if (!element || !content) return
    // Markdown loads lazily; composer and mobile viewport resizing also change
    // the bottom position without necessarily changing the message array.
    const observer = new ResizeObserver(() => {
      if (follow.current) scrollToLatest()
    })
    observer.observe(element)
    observer.observe(content)
    return () => observer.disconnect()
  }, [])
  async function act(path: string, body: object = {}) {
    setQueueAction(true)
    setError('')
    try { await api(`/conversations/${conversation.id}/${path}`, body) }
    catch (error) { setError(errorMessage(error)) }
    finally { setQueueAction(false) }
  }
  async function addFiles(files: File[]) {
    if (readingLock.current || sendLock.current) return
    readingLock.current = true
    setReading(true)
    setError('')
    try {
      if (files.length + attachments.length > MAX_ATTACHMENTS) throw new Error('You can attach up to 4 files per message.')
      const existingSize = attachments.reduce((sum, file) => sum + atob(file.data).length, 0)
      if (existingSize + files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_ATTACHMENT_BYTES)
        throw new Error('Attachments cannot exceed 4 MB per message.')
      const added: Attachment[] = []
      for (const file of files) {
        if (!file.size || file.size > MAX_ATTACHMENT_BYTES) throw new Error(`${file.name}: the file must be between 1 byte and 2 MB.`)
        const mediaType = attachmentMediaType(file.name, file.type)
        if (file.name.length > 255) throw new Error('The file name is too long.')
        if (mediaType === 'text/plain') {
          const bytes = new Uint8Array(await file.arrayBuffer())
          if (bytes.includes(0)) throw new Error(`${file.name}: not a text file.`)
          try { new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
          catch { throw new Error(`${file.name}: use UTF-8 encoded text.`) }
        }
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
          reader.onabort = () => reject(new Error('Reading canceled.'))
          reader.onload = () => resolve(String(reader.result).split(',')[1])
          reader.readAsDataURL(file)
        })
        added.push({ name: file.name, mediaType, data })
      }
      setAttachments((current) => [...current, ...added])
    } catch (error) { setError(errorMessage(error)) }
    finally { readingLock.current = false; setReading(false) }
  }
  async function send() {
    if ((!text.trim() && !attachments.length) || readingLock.current || sendLock.current || queueAction) return
    if (!configured) { settings(); return }
    // Focus during the user's action, not after the request: do not steal focus
    // if they move to another control while waiting for the response.
    composer.current?.querySelector('textarea')?.focus({ preventScroll: true })
    sendLock.current = true
    setSending(true)
    setError('')
    follow.current = true
    scrollToLatest()
    try {
      await api(`/conversations/${conversation.id}/messages`, { text, provider, attachments, mode: 'queue' })
      setText('')
      setAttachments([])
    } catch (error) { setError(errorMessage(error)) }
    finally { sendLock.current = false; setSending(false) }
  }
  return (
    <div className="chat-panel">
      <div className="messages" ref={scroller} onScroll={() => {
        const element = scroller.current
        if (element) follow.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100
      }}>
        <div ref={messageContent} style={{ display: 'flow-root' }}>
        {!conversation.messages.length && (
          <div className="chat-welcome">
            <span className="welcome-symbol"><Sparkles size={27} strokeWidth={1.4} /></span>
            <p className="eyebrow">A SPACE TO THINK AND CREATE</p>
            <h1>What shall we build today?</h1>
            <p>An idea, a problem, the next step.<br />It all starts here, in your project.</p>
            <div className="prompt-suggestions">
              {['Explore this project', 'Help me plan a feature', 'Review the code and suggest improvements'].map((prompt) => (
                <button key={prompt} onClick={() => setText(prompt)}>{prompt}<span>↗</span></button>
              ))}
            </div>
          </div>
        )}
        {conversation.messages.map((message) => (
          <article key={message.id} className="message" data-role={message.role}>
            <div className="message-avatar">{message.role === 'user' ? 'You' : 'a·'}</div>
            <div className="message-content">
              <div className="message-heading">
                {message.role === 'user' ? 'You' : 'Alfred'}
                <time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
              </div>
              {!!message.attachments?.length && <div className="attachment-list" aria-label="Attachments">
                {message.attachments.map((file, index) => (
                  <a className="attachment-chip" key={index} download={file.name} href={`data:${file.mediaType};base64,${file.data}`} title={`Download ${file.name}`}>
                    <Paperclip size={14} /><span>{file.name}</span>
                  </a>
                ))}
              </div>}
              <div className="markdown">
                <Suspense fallback={<p>{message.text}</p>}>
                  <Markdown conversationId={conversation.id}>{message.text}</Markdown>
                </Suspense>
              </div>
              {message.notes.length > 0 && <details className="tool-notes"><summary>Activity · {message.notes.length}</summary>{message.notes.map((note, index) => <p key={index}>{note}</p>)}</details>}
            </div>
          </article>
        ))}
        {agent?.status === 'running' && <div className="agent-progress"><span className="status-dot" data-status="running" />Alfred is working…</div>}
        {agent?.approval && <ApprovalCard key={agent.approval.id} approval={agent.approval} conversationId={conversation.id} onError={setError} />}
        </div>
      </div>
      <div className="composer-wrap">
        {error && <p role="alert" className="error-text">{error}</p>}
        {agent?.status === 'error' && agent.detail && <p role="alert" className="error-text">{agent.detail}</p>}
        {!!queue.length && <section className="message-queue" aria-label="Queued messages">
          <div className="message-queue-heading">
            <span role="status">{conversation.queuePaused ? 'Queue paused' : 'Queued'} · {queue.length}</span>
            {!busy && <Button type="button" variant="secondary" size="small" disabled={queueAction || sending} onClick={() => void act('queue/resume')}>Resume queue</Button>}
          </div>
          <ol>
            {queue.map((item) => <li key={item.id}>
              <span title={item.text || item.attachments.map((file) => file.name).join(', ')}>{item.text || item.attachments.map((file) => file.name).join(', ')}{item.text && item.attachments.length > 0 ? ` · ${item.attachments.length} attachment(s)` : ''}</span>
              <Button type="button" variant="secondary" size="icon" aria-label={`Remove from queue: ${(item.text || item.attachments[0]?.name || 'Message').slice(0, 80)}`} disabled={queueAction || sending} onClick={() => void act('queue/remove', { messageId: item.id })}><X size={14} /></Button>
            </li>)}
          </ol>
        </section>}
        <form ref={composer} className={`composer${dragging ? ' composer-dragging' : ''}`}
          onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = sending || reading ? 'none' : 'copy'; setDragging(!sending && !reading) } }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }}
          onDrop={(event) => { event.preventDefault(); setDragging(false); void addFiles(Array.from(event.dataTransfer.files)) }}
          onPaste={(event) => {
            if (!(event.target instanceof HTMLTextAreaElement)) return
            const files = Array.from(event.clipboardData.files)
            if (!files.length) return
            event.preventDefault()
            void addFiles(files)
          }}
          onSubmit={(event) => { event.preventDefault(); void send() }}>
          {dragging && <div className="attachment-drop-hint">Drop files to attach them</div>}
          {!!attachments.length && <div className="attachment-list" aria-label="Pending attachments">
            {attachments.map((file, index) => <span className="attachment-chip" key={index}>
              <Paperclip size={14} /><span title={file.name}>{file.name}</span>
              <button type="button" disabled={sending || reading} aria-label={`Remove ${file.name}`} onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))}><X size={14} /></button>
            </span>)}
          </div>}
          <ComposerInput conversationId={conversation.id} value={text} onChange={setText} sending={sending} busy={busy} onSend={() => void send()} settings={settings} />
          <div className="composer-footer">
            <div className="attachment-controls">
              <input ref={fileInput} type="file" multiple hidden onChange={(event) => { void addFiles(Array.from(event.target.files || [])); event.target.value = '' }} />
              <select className="context-control" aria-label="Select agent" title="Alfred is the only available agent" value="alfred" disabled>
                <option value="alfred">Alfred</option>
              </select>
              <ModelPicker state={state} provider={provider} onSelect={setProvider} settings={settings} disabled={sending} />
              <ContextPermissions conversation={conversation} state={state} provider={provider} busy={busy || sending || queueAction} />
            </div>
            <div className="queue-send-actions">
              <Button type="button" variant="secondary" size="icon" disabled={sending || reading} aria-label="Attach files" title="Attach images or text · maximum 2 MB per file" onClick={() => fileInput.current?.click()}><Paperclip size={17} /></Button>
              {busy && <>
                <Button type="button" variant="secondary" size="icon" disabled={queueAction || sending} aria-label="Stop response and pause queue" onClick={() => void act('stop')}><Square size={15} /></Button>
              </>}
              <Button type="submit" size="icon" disabled={!canSend} aria-label={busy || queue.length || conversation.queuePaused ? 'Queue message' : 'Send message'} title={busy || queue.length || conversation.queuePaused ? 'Queue message' : 'Send message'}><ArrowUp size={19} /></Button>
            </div>
          </div>
          {reading && <p role="status">Preparing attachments…</p>}
        </form>
      </div>
    </div>
  )
}
