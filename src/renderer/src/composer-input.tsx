import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, errorMessage } from './api'

type Props = {
  conversationId: string; value: string; onChange: (value: string) => void
  sending: boolean; busy: boolean; onSend: () => void; settings: () => void
}
const commands = [
  { name: '/explore', description: 'Explore the project', text: 'Explore this project and explain its structure.' },
  { name: '/plan', description: 'Prepare a plan', text: 'Help me plan the following feature: ' },
  { name: '/review', description: 'Review code', text: 'Review the code and suggest improvements: ' },
  { name: '/settings', description: 'Open settings', text: '' },
]
export function ComposerInput({ conversationId, value, onChange, sending, busy, onSend, settings }: Props) {
  const input = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const element = input.current
    if (!element) return
    const resize = () => {
      element.style.height = 'auto'
      element.style.height = `${element.scrollHeight}px`
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [value])
  const id = useId()
  const [caret, setCaret] = useState(value.length)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [selected, setSelected] = useState(0)
  const [result, setResult] = useState<{ key: string; files: string[]; truncated?: boolean; error?: string }>({ key: '', files: [] })
  const match = /(?:^|\s)([@/])([^\s@/]*)$/.exec(value.slice(0, caret))
  // File queries may contain directory separators.
  const fileMatch = /(?:^|\s)@([^\s@]*)$/.exec(value.slice(0, caret))
  const marker = fileMatch ? '@' : match?.[1]
  const query = fileMatch ? fileMatch[1] : match?.[2] || ''
  const open = focused && !dismissed && !sending && !!marker
  const [position, setPosition] = useState({ left: 0, bottom: 0, width: 0, maxHeight: 260 })
  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const rect = input.current?.getBoundingClientRect()
      if (!rect) return
      setPosition({ left: rect.left, bottom: window.innerHeight - rect.top + 6,
        width: rect.width, maxHeight: Math.max(0, Math.min(260, rect.top - 14)) })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const observer = new ResizeObserver(update)
    if (input.current) observer.observe(input.current)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      observer.disconnect()
    }
  }, [open])
  const key = `${conversationId}:${query}`
  useEffect(() => {
    if (!open || marker !== '@') return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void api<{ files: string[]; truncated: boolean }>(`/conversations/${conversationId}/files?query=${encodeURIComponent(query)}`, undefined, undefined, controller.signal)
        .then((data) => { if (!controller.signal.aborted) setResult({ key, ...data }) })
        .catch((error) => { if (!controller.signal.aborted) setResult({ key, files: [], error: errorMessage(error) }) })
    }, 180)
    return () => { clearTimeout(timer); controller.abort() }
  }, [open, marker, query, conversationId, key])
  const items = marker === '@'
    ? (result.key === key ? result.files : []).map((path) => ({ name: path, description: 'Workspace file', text: `@${JSON.stringify(path)} ` }))
    : commands.filter((command) => command.name.includes(query.toLowerCase()))
  const active = Math.min(selected, Math.max(0, items.length - 1))
  function choose(index: number) {
    const item = items[index]
    if (!item) return
    const start = caret - query.length - 1
    const next = value.slice(0, start) + item.text + value.slice(caret)
    onChange(next)
    setDismissed(true)
    if (item.name === '/settings' && marker === '/') { settings(); return }
    requestAnimationFrame(() => {
      input.current?.focus()
      input.current?.setSelectionRange(start + item.text.length, start + item.text.length)
    })
  }
  return <div style={{ position: 'relative' }}>
    {open && createPortal(<div style={{ position: 'fixed', ...position, boxSizing: 'border-box', zIndex: 1000, overflowY: 'auto', background: 'var(--background, #202124)', color: 'var(--foreground, #fff)', border: '1px solid #777', borderRadius: 8, padding: 8 }}>
      <div>{marker === '@' ? 'Project files' : 'Commands'} · ↑ ↓ select · Enter accept · Esc close</div>
      <div id={id} role="listbox" aria-label={marker === '@' ? 'Project files' : 'Commands'}>
        {items.map((item, index) => <button id={`${id}-${index}`} key={item.name} type="button" role="option" aria-selected={active === index}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: 8, background: active === index ? '#39465c' : 'transparent', color: 'inherit', border: 0 }}
          onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)}>
          <strong>{item.name}</strong> <small>{item.description}</small>
        </button>)}
      </div>
      {!items.length && <p role="status">{marker === '@' && result.key !== key ? 'Searching files…' : result.key === key && marker === '@' && result.error ? result.error : 'No matches.'}</p>}
      {marker === '@' && result.key === key && result.truncated && <small>List truncated; type a path to narrow the search.</small>}
    </div>, document.body)}
    <textarea ref={input} className="textarea" aria-label="Message for Alfred" value={value} readOnly={sending} aria-busy={sending}
      aria-autocomplete="list" aria-controls={open ? id : undefined} aria-expanded={open} aria-activedescendant={open && items.length ? `${id}-${active}` : undefined}
      placeholder={busy ? 'Type to queue a message…' : 'Type / for commands or @ for files…'} rows={2}
      onFocus={() => { setFocused(true); setDismissed(false) }} onBlur={() => { setFocused(false); setDismissed(true) }}
      onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
      onChange={(event) => { onChange(event.target.value); setCaret(event.target.selectionStart); setDismissed(false); setSelected(0) }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return
        if (event.key === 'Tab') {
          const element = event.currentTarget
          const start = element.selectionStart
          const lineStart = value.lastIndexOf('\n', start - 1) + 1
          // Only indent a new line while its prefix is still whitespace.
          // Otherwise preserve native focus navigation, including Shift+Tab.
          if (!sending && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey &&
            start === element.selectionEnd && lineStart > 0 && /^[\t ]*$/.test(value.slice(lineStart, start))) {
            event.preventDefault()
            onChange(value.slice(0, start) + '\t' + value.slice(start))
            setCaret(start + 1)
            setDismissed(true)
            requestAnimationFrame(() => element.setSelectionRange(start + 1, start + 1))
          }
          return
        }
        if (open) {
          if (event.key === 'Escape') { event.preventDefault(); setDismissed(true); return }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setSelected(items.length ? (active + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length : 0); return
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            if (items.length) { event.preventDefault(); choose(active); return }
            if (event.key === 'Enter') { event.preventDefault(); return }
          }
        }
        if (event.key === 'Enter' && !event.shiftKey && !matchMedia('(pointer: coarse)').matches) { event.preventDefault(); onSend() }
      }} />
  </div>
}
