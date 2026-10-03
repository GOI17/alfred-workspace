import { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { colors, spacing, radii, typography } from '../src/theme/mobile-theme'
import { parsePairingCode } from '../src/transport/pairing'
import type { MobileWebBundleFetchResult } from '../src/transport/mobile-web-bundle-fetch'
import type { HostProfile } from '../src/transport/types'
import { BrowserPairingStore } from './browser-pairing-store'
import { openBrowserHost, pairBrowserHost, recoverBrowserPairing } from './browser-host-client'
import { readBrowserHostInterface } from './browser-host-interface'
import { mountBrowserBundle } from './browser-bundle-frame'
import { consumeBrowserPairingLink } from './browser-pairing-link'
import { BrowserPairingForm } from './BrowserPairingForm'
import './page.css'

const incoming = consumeBrowserPairingLink() ?? ''
for (const [name, value] of Object.entries(colors)) {
  document.documentElement.style.setProperty(`--${name}`, value)
}
for (const [name, value] of Object.entries(spacing)) {
  document.documentElement.style.setProperty(`--${name}`, `${value}px`)
}
document.documentElement.style.setProperty('--radius', `${radii.button}px`)
document.documentElement.style.setProperty('--body', `${typography.bodySize}px`)
document.documentElement.style.setProperty('--title', `${typography.titleSize}px`)

type Session = Awaited<ReturnType<typeof openBrowserHost>> & { host: HostProfile }

function HostInterface({
  session,
  bundle
}: {
  session: Session
  bundle: MobileWebBundleFetchResult
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    if (frame.current) {
      return mountBrowserBundle({
        frame: frame.current,
        client: session.client,
        host: session.host,
        bundle
      })
    }
  }, [session, bundle])
  return <iframe ref={frame} title="Host workspace" sandbox="allow-scripts" />
}

function BrowserApp() {
  const [code, setCode] = useState(incoming)
  const [session, setSession] = useState<Session | null>(null)
  const [bundle, setBundle] = useState<MobileWebBundleFetchResult | null>(null)
  const [status, setStatus] = useState(
    incoming ? 'Connecting to desktop' : 'Pair your desktop to start'
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(Boolean(incoming))
  const active = useRef<Session | null>(null)
  const attempt = useRef<AbortController | null>(null)
  const store = useRef<BrowserPairingStore | null>(null)
  const offer = parsePairingCode(code)

  function pairingStore(): BrowserPairingStore {
    store.current ??= new BrowserPairingStore(sessionStorage)
    return store.current
  }

  async function enter(pair: boolean, pairingCode = code) {
    if (attempt.current) {
      return
    }
    const controller = new AbortController()
    attempt.current = controller
    setBusy(true)
    setError(null)
    try {
      if (!window.isSecureContext) {
        throw new Error('Open this page over HTTPS to pair your phone securely.')
      }
      if (!HTMLScriptElement.supports?.('importmap')) {
        throw new Error('Update your browser to open the desktop interface.')
      }
      const saved = pairingStore()
      setStatus('Connecting to desktop')
      if (saved.read().journal) {
        const outcome = await recoverBrowserPairing(saved)
        if (outcome === 'deferred') {
          throw new Error('Pairing is pending. Keep desktop connected and retry.')
        }
      }
      if (controller.signal.aborted) {
        return
      }
      if (pair) {
        const selectedOffer = parsePairingCode(pairingCode)
        if (!selectedOffer) {
          throw new Error('Paste a valid pairing code from desktop.')
        }
        if (
          !selectedOffer.relay &&
          new URL(selectedOffer.endpoint).protocol !== 'wss:' &&
          !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
        ) {
          throw new Error('Generate an Anywhere pairing code on desktop to connect through Relay.')
        }
        active.current?.close()
        active.current = null
        setSession(null)
        setBundle(null)
        await pairBrowserHost(selectedOffer, saved, controller.signal)
        setCode('')
      }
      if (controller.signal.aborted) {
        return
      }
      let opened = active.current
      if (!opened) {
        const host = saved.read().host
        if (!host) {
          throw new Error('Generate a pairing code on desktop to start.')
        }
        opened = { ...(await openBrowserHost(host, saved)), host }
        if (controller.signal.aborted) {
          opened.close()
          return
        }
        active.current = opened
        setSession(opened)
      }
      const next = await readBrowserHostInterface(opened.client, controller.signal, setStatus)
      if (controller.signal.aborted) {
        return
      }
      setBundle(next)
      setStatus('Connected')
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not open desktop. Retry or generate a new pairing code.'
        )
        setStatus('Connection needs attention')
      }
    } finally {
      if (attempt.current === controller) {
        attempt.current = null
        setBusy(false)
      }
    }
  }

  useEffect(() => {
    try {
      if (incoming) {
        void enter(true, incoming)
      } else if (pairingStore().read().host || pairingStore().read().journal) {
        void enter(false)
      }
    } catch {
      setError('Browser storage is unavailable. Allow storage for this site and reload.')
    }
    return () => {
      attempt.current?.abort()
      active.current?.close()
    }
  }, [])

  useEffect(
    () =>
      session?.client.onStateChange((state) =>
        setStatus(state === 'connected' ? 'Connected' : 'Reconnecting to desktop')
      ),
    [session]
  )

  const leave = useCallback(() => {
    attempt.current?.abort()
    attempt.current = null
    active.current?.close()
    active.current = null
    setSession(null)
    setBundle(null)
    setBusy(false)
    setStatus('Disconnected')
    setError(null)
  }, [])

  useEffect(() => {
    const receiveLink = () => {
      const next = consumeBrowserPairingLink()
      if (next !== null) {
        leave()
        setCode(next)
        void enter(true, next)
      }
    }
    window.addEventListener('hashchange', receiveLink)
    receiveLink()
    return () => window.removeEventListener('hashchange', receiveLink)
  }, [leave])

  return (
    <div className={bundle ? 'browser-shell' : 'browser-start'}>
      {session && (
        <header>
          <button onClick={leave}>Disconnect</button>
          <span role="status">{status}</span>
          <button
            disabled={busy}
            onClick={() => {
              if (window.confirm('Reload the interface? Unsaved drafts will be lost.')) {
                void enter(false)
              }
            }}
          >
            Reload UI
          </button>
        </header>
      )}
      {error && (
        <aside role="alert">
          <p>{error}</p>
          <button
            disabled={busy}
            onClick={() => {
              active.current?.reconnect()
              void enter(!active.current && Boolean(offer))
            }}
          >
            Retry
          </button>
        </aside>
      )}
      {session && bundle ? (
        <HostInterface session={session} bundle={bundle} />
      ) : (
        <main>
          <h1>Alfred Workspace</h1>
          <p>Use your desktop from this browser. No app installation required.</p>
          <BrowserPairingForm
            code={code}
            valid={Boolean(offer)}
            busy={busy}
            onCode={setCode}
            onPair={() => void enter(true)}
          />
          <p role="status">{status}</p>
          {busy && !session && <button onClick={leave}>Cancel connection</button>}
          <p>
            Pairing is remembered for this tab. Keep your desktop running. Audio and attachments are
            not available here yet.
          </p>
          {!busy && (
            <div className="actions">
              <button onClick={() => void enter(false)}>Reconnect saved desktop</button>
              <button
                onClick={() => {
                  leave()
                  try {
                    pairingStore().clear()
                    store.current = null
                    setCode('')
                    setStatus('Pairing removed from this tab')
                  } catch {
                    setError('Could not clear browser storage. Close this tab to end the session.')
                  }
                }}
              >
                Forget this browser
              </button>
            </div>
          )}
        </main>
      )}
    </div>
  )
}

const root = document.getElementById('root')
if (!root) {
  throw new Error('Missing browser root')
}
createRoot(root).render(<BrowserApp />)
