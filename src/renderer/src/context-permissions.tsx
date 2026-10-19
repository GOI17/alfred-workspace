import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Gauge, ShieldCheck, X } from 'lucide-react'
import type { Conversation, PermissionMode, ProviderId, PublicState } from '../../shared/contracts'
import { latestContextUsage, contextRemaining } from '../../shared/context-usage'
import { api, errorMessage } from './api'
import { Button } from './components/ui/button'
import './assets/context-permissions.css'

function Control({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 700px)').matches)
  const trigger = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState({ left: 12, bottom: 12, maxHeight: 400 })
  useEffect(() => {
    const query = matchMedia('(max-width: 700px)')
    const update = () => setMobile(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useLayoutEffect(() => {
    if (!open || mobile) return
    const update = () => {
      const rect = trigger.current?.getBoundingClientRect()
      if (!rect) return
      setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - Math.min(360, window.innerWidth - 24) - 12)), bottom: Math.max(12, window.innerHeight - rect.top + 8), maxHeight: Math.max(0, rect.top - 20) })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [open, mobile])
  return <Dialog.Root modal={mobile} open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><button ref={trigger} type="button" className="context-control" title={label}>{icon}<span>{label}</span></button></Dialog.Trigger>
    <Dialog.Portal>
      {mobile && <Dialog.Overlay className="dialog-overlay" />}
      <Dialog.Content className={`dialog-content context-dialog${mobile ? '' : ' context-dropdown'}`} style={mobile ? undefined : position}>
        <div className="dialog-heading"><Dialog.Title>{label}</Dialog.Title><Dialog.Close asChild><Button type="button" variant="ghost" size="icon" aria-label="Close"><X size={18} /></Button></Dialog.Close></div>
        <Dialog.Description>Information and controls for this conversation.</Dialog.Description>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
export function ContextPermissions({ conversation, state, provider, busy }: {
  conversation: Conversation; state: PublicState; provider: ProviderId; busy: boolean
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<PermissionMode | null>(null)
  const lock = useRef(false)
  const mode = conversation.permissionMode || 'approval'
  const model = state.providers.find((item) => item.id === provider)?.model
  const usage = latestContextUsage(conversation.messages, provider, model)
  const used = usage?.inputTokens
  const remaining = usage ? contextRemaining(usage) : undefined
  const format = (value: number) => value.toLocaleString()
  const contextLabel = used === undefined ? 'Context: —' : usage?.limit === undefined ? `${format(used)} tokens` : `${format(used)} / ${format(usage.limit)} tokens`
  async function change(value: PermissionMode, stopFirst = false) {
    if (lock.current || value === mode) return
    if (busy && !stopFirst) { setPending(value); setError(''); return }
    if (value === 'full-access' && !window.confirm('Enable Full access for this conversation?\n\nThe agent can create and overwrite workspace files without approval, including when processing the queue. Enabled terminal and authorized MCP tools can run automatically, including ask permissions. Explicit blocks are respected. Terminal and MCP are not sandboxed to the workspace. Stopping does not undo completed actions.\n\nThis permission persists across reloads until you change it.')) return
    lock.current = true
    setSaving(true)
    setError('')
    try {
      // The server rejects changes if another client starts a run after stopping.
      if (stopFirst) await api(`/conversations/${conversation.id}/stop`, {})
      await api(`/conversations/${conversation.id}/permissions`, { mode: value, confirmed: value === 'full-access' }, 'PUT')
      setPending(null)
    }
    catch (error) { setError(errorMessage(error)) }
    finally { lock.current = false; setSaving(false) }
  }
  return <>
    <span className="context-indicator" role="status" title={usage ? `Last measured input: ${format(usage.inputTokens)} tokens. ${remaining === undefined ? 'Unknown limit.' : `Remaining based on that measurement: ${format(remaining)} tokens.`} Measured at: ${usage.measuredAt}. Includes cache, instructions, and submitted tools. Excludes the response, draft, queue, and later results. Not cumulative usage or a live count.` : 'No measurement available for the selected model.'}>
      <Gauge size={15} aria-hidden="true" />
      <span>{contextLabel}</span>
      {usage?.limit !== undefined && used !== undefined && <meter aria-label="Context window usage in the last step" min={0} max={usage.limit} value={Math.min(used, usage.limit)} />}
    </span>
    <Control label={mode === 'read-only' ? 'Read only' : mode === 'full-access' ? 'Full access' : 'Ask for approval'} icon={<ShieldCheck size={15} />}>
      <fieldset className="permission-options" disabled={saving}>
        <legend>Agent permissions</legend>
        <label><input type="radio" name={`permission-${conversation.id}`} checked={mode === 'read-only'} onChange={() => void change('read-only')} />Read only<small>Explore and respond, without file writes, terminal, or MCP.</small></label>
        <label><input type="radio" name={`permission-${conversation.id}`} checked={mode === 'approval'} onChange={() => void change('approval')} />Ask for approval<small>Every write, command, or MCP execution requires explicit approval.</small></label>
        <label><input type="radio" name={`permission-${conversation.id}`} checked={mode === 'full-access'} onChange={() => void change('full-access')} />Full access<small>Automatic writes. Terminal and MCP must be enabled separately; authorized tools run without prompting, including ask permissions. Explicit blocks are respected.</small></label>
      </fieldset>
      {mode === 'full-access' && <p role="status"><strong>Full access active:</strong> authorized operations run automatically. Stopping does not undo completed changes.</p>}
      <p>Saved per conversation and also applied when queued messages are processed. Does not change manual terminal, browser, or Git controls.</p>
      {busy && !pending && <p role="status">Select another permission to stop the agent and change it.</p>}
      {pending && pending !== mode && <div>
        <p role="status">Switch to <strong>{pending === 'read-only' ? 'Read only' : pending === 'full-access' ? 'Full access' : 'Ask for approval'}</strong>: the run will stop, pending approval will be rejected, and the queue will pause. Completed writes will not be undone and work will not resume automatically.</p>
        <Button type="button" disabled={saving} onClick={() => void change(pending, true)}>Stop and change permissions</Button>
        <Button type="button" variant="secondary" disabled={saving} onClick={() => setPending(null)}>Cancel</Button>
      </div>}
      {saving && <p role="status">{pending ? 'Stopping and saving permissions…' : 'Saving permissions…'}</p>}
      {error && <p role="alert" className="error-text">{error}</p>}
      <p>Configure terminal and MCP servers in Settings → Terminal and MCP.</p>
    </Control>
  </>
}
