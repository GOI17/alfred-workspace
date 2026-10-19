import { useEffect, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { api, errorMessage } from './api'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Dialog } from './components/ui/dialog'

export function Login({ connected }: { connected: () => Promise<void> }) {
  const [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  return (
    <div className="login-screen">
      <div className="login-card">
        <span className="brand-mark">a·</span>
        <p className="eyebrow">YOUR WORKSPACE, WITH YOU</p>
        <h1>Welcome back.</h1>
        <p>Connect this device using the code shown when the Alfred server starts.</p>
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            setBusy(true)
            try {
              await api('/auth', { code })
              await connected()
            } catch (error) {
              setError(errorMessage(error))
            } finally {
              setBusy(false)
            }
          }}
        >
          <label>
            Connection code
            <Input
              required
              type="password"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Server code"
              autoComplete="off"
            />
          </label>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? 'Connecting…' : 'Enter my workspace'}
            <ArrowUpRight size={16} />
          </Button>
        </form>
      </div>
    </div>
  )
}
type TunnelStatus = {
  state: 'disabled' | 'stopped' | 'connecting' | 'connected' | 'stopping' | 'error'
  url?: string
  error?: string
}
export function useTunnelStatus(enabled = true) {
  const [tunnel, setTunnel] = useState<TunnelStatus>()
  const [error, setError] = useState('')
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const refresh = async () => {
      try {
        const result = await api<TunnelStatus>('/connection/tunnel', undefined, 'GET', controller.signal)
        if (!controller.signal.aborted) { setTunnel(result); setError('') }
      } catch (error) {
        if (!controller.signal.aborted) setError(errorMessage(error))
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(() => void refresh(), 2000)
      }
    }
    void refresh()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [enabled])
  return { tunnel, setTunnel, error, setError }
}
export function PhoneDialog({ onClose }: { onClose: () => void }) {
  const { tunnel, setTunnel, error, setError } = useTunnelStatus()
  const [busy, setBusy] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  async function change(connect: boolean) {
    setBusy(true)
    setError('')
    try {
      setTunnel(await api<TunnelStatus>('/connection/tunnel', connect ? { confirmed: true } : undefined, connect ? 'POST' : 'DELETE'))
    } catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false) }
  }
  const labels = { disabled: 'Not configured', stopped: 'Disconnected', connecting: 'Connecting…', connected: 'Connected', stopping: 'Disconnecting…', error: 'Error' }
  return (
    <Dialog open onClose={onClose} title="Your workspace on your phone"
      description="HTTPS access from any network through Cloudflare Tunnel.">
      <p role="status">{tunnel ? labels[tunnel.state] : 'Checking connection…'}</p>
      {tunnel?.state === 'disabled' ? (
        <p>Install cloudflared and configure ALFRED_PUBLIC_ORIGIN, ALFRED_CLOUDFLARE_TUNNEL, and ALFRED_CLOUDFLARE_CONFIG on the server. See the Cloudflare guide in docs.</p>
      ) : tunnel && (
        <>
          {tunnel.url && <p><a className="text-link" href={tunnel.url} target="_blank" rel="noreferrer">{tunnel.url}</a></p>}
          <p className="field-note">The computer must remain on. Sign in on your phone with the Alfred code. Closing this dialog does not disconnect the tunnel.</p>
          {['stopped', 'error'].includes(tunnel.state) && (
            <label style={{ gridTemplateColumns: '20px minmax(0, 1fr)', alignItems: 'start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                style={{ width: '20px', height: '20px', margin: '2px 0 0', accentColor: 'var(--primary)' }}
              />
              <span>I authorize publishing Alfred through Cloudflare. Traffic passes through Cloudflare; access still requires authentication.</span>
            </label>
          )}
          <div className="dialog-actions">
            {['stopped', 'error'].includes(tunnel.state) && <Button disabled={busy || !confirmed || !['stopped', 'error'].includes(tunnel.state)} onClick={() => void change(true)}>Connect phone</Button>}
            <Button variant="secondary" disabled={busy || ['stopped', 'stopping'].includes(tunnel.state)} onClick={() => void change(false)}>Disconnect</Button>
          </div>
          <p className="field-note">If the connection fails, disconnect before trying again. Disconnecting from your phone will end remote access.</p>
        </>
      )}
      {(error || tunnel?.error) && <p className="error-text" role="alert">{error || tunnel?.error}</p>}
      <div className="dialog-actions"><Button onClick={onClose}>Close</Button></div>
    </Dialog>
  )
}
