import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import {
  localMobileBrowserEntryUrl,
  mobileBrowserPairingOptions
} from '../../../../shared/mobile-browser-link'

const ENTRY_KEY = 'alfred.mobileBrowserEntryUrl'

function savedEntry(): string {
  try {
    const value = localStorage.getItem(ENTRY_KEY) ?? ''
    return mobileBrowserPairingOptions(value).connectionMode === 'automatic' ? value : ''
  } catch {
    return ''
  }
}

export function MobileBrowserAccessSection(): React.JSX.Element {
  const [entry, setEntry] = useState(savedEntry)
  const [link, setLink] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [qrSize, setQrSize] = useState(288)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)
  const [localPreview, setLocalPreview] = useState(true)
  useEffect(
    () => () => {
      request.current++
    },
    []
  )

  async function generate(local: boolean) {
    const id = ++request.current
    setError(null)
    setBusy(true)
    setLink(null)
    setQr(null)
    setCopied(false)
    setLocalPreview(local)
    try {
      let entryUrl = entry.trim()
      if (local) {
        const server = await window.api.mobile.isWebSocketReady()
        if (!server.ready || !server.endpoint) {
          throw new Error('Desktop is still starting. Try again in a moment.')
        }
        entryUrl = localMobileBrowserEntryUrl(server.endpoint)
      }
      const options = mobileBrowserPairingOptions(entryUrl)
      if (!local && options.connectionMode !== 'automatic') {
        throw new Error('Phone access needs your hosted HTTPS entry address.')
      }
      if (id !== request.current) {
        return
      }
      const result = await window.api.mobile.getPairingQR({
        ...options,
        rotate: true
      })
      if (id !== request.current) {
        return
      }
      if (!result.available) {
        if (result.relayFailure?.code === 'relay_provider_unavailable') {
          throw new Error(
            'Relay is not configured in this desktop build. Use Open in browser for local access; phone access requires a configured Relay.'
          )
        }
        throw new Error(
          result.guidance ?? 'Keep desktop signed in and reconnect Relay before trying again.'
        )
      }
      if (!result.browserUrl) {
        throw new Error('Update desktop to generate browser pairing links.')
      }
      setLink(result.browserUrl)
      setQr(result.qrDataUrl)
      setQrSize(result.qrSize ?? 288)
      try {
        if (!local) {
          localStorage.setItem(ENTRY_KEY, options.browserEntryUrl)
        }
      } catch {
        /* The pairing link remains usable without saving its entry address. */
      }
      if (local) {
        await window.api.shell.openUrl(result.browserUrl)
      }
    } catch (cause) {
      if (id === request.current) {
        setError(cause instanceof Error ? cause.message : 'Could not generate browser access.')
      }
    } finally {
      if (id === request.current) {
        setBusy(false)
      }
    }
  }

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Open in browser</h3>
        <p className="text-xs text-muted-foreground">
          Open this desktop’s workspace in your browser. No app installation or address setup
          required.
        </p>
      </div>
      <Button onClick={() => void generate(true)} disabled={busy}>
        {busy && localPreview ? 'Opening…' : 'Open in browser'}
      </Button>
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost">Access from your phone</Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 pt-3">
            <Label htmlFor="mobile-browser-entry">Phone access address</Label>
            <Input
              id="mobile-browser-entry"
              value={entry}
              placeholder="https://your-site.example/mobile-browser.html"
              onChange={(event) => {
                request.current++
                setEntry(event.target.value)
                setLink(null)
                setQr(null)
                setBusy(false)
                setError(null)
              }}
            />
            <p className="text-xs text-muted-foreground">
              Phone access needs your hosted HTTPS entry and Relay. Local browser access uses this
              desktop’s address automatically.
            </p>
            <Button onClick={() => void generate(false)} disabled={busy || !entry.trim()}>
              {busy && !localPreview ? 'Preparing link…' : 'Create phone link'}
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {link && (
        <div className="space-y-3">
          {qr && !localPreview ? (
            <img
              src={qr}
              width={qrSize}
              height={qrSize}
              className="max-w-full"
              alt="Scan to open Alfred Workspace in your phone browser"
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              {localPreview
                ? 'Opened in your browser. You can also copy the link below.'
                : 'Copy the link to your phone to continue.'}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Opening this link connects automatically and grants access to your desktop. Use it only
            on your own device.
          </p>
          <Button
            variant="outline"
            onClick={() =>
              void window.api.ui.writeClipboardText(link).then(
                () => setCopied(true),
                () => setError('Could not copy the link. Try again.')
              )
            }
          >
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      )}
    </section>
  )
}
