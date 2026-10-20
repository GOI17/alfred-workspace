import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import type { Conversation, PublicState } from '../../shared/contracts'
import { api, errorMessage } from './api'
import { Button } from './components/ui/button'
import { Dialog } from './components/ui/dialog'
import { useUI } from './ui-preferences'

function supported() {
  return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}
async function registration() {
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}
export function ActivityCenter({ state, connected, select }: {
  state: PublicState; connected: boolean; select: (conversation: Conversation) => void
}) {
  const { t } = useUI()
  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checked, setChecked] = useState(false)
  const available = supported()
  useEffect(() => {
    if (!available) return
    let alive = true
    void registration().then(async (worker) => {
      const subscription = await worker.pushManager.getSubscription()
      // Resync after a server restart/restore, but never request permission automatically.
      if (subscription && Notification.permission === 'granted') {
        await api('/notifications', subscription.toJSON())
        if (alive) setEnabled(true)
      }
    }).catch((error) => { if (alive) setError(errorMessage(error)) })
      .finally(() => { if (alive) setChecked(true) })
    return () => { alive = false }
  }, [available])
  async function toggle() {
    setError(''); setBusy(true)
    try {
      if (!enabled) {
        // Must run directly from a user gesture, especially on iOS.
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') throw new Error(t('Allow notifications in your browser settings.', 'Permite las notificaciones en los ajustes del navegador.'))
      }
      const worker = await registration()
      let subscription = await worker.pushManager.getSubscription()
      if (enabled) {
        if (subscription) {
          await api('/notifications', { endpoint: subscription.endpoint }, 'DELETE')
          await subscription.unsubscribe()
        }
        setEnabled(false)
      } else {
        const { publicKey } = await api<{ publicKey: string }>('/notifications')
        const key = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0))
        subscription ||= await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
        await api('/notifications', subscription.toJSON())
        setEnabled(true)
      }
    } catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false) }
  }
  const active = state.conversations.filter((item) => ['running', 'waiting'].includes(state.agents[item.id]?.status))
  return <>
    <Button variant="ghost" size="small" onClick={() => setOpen(true)} aria-label={t('Activity and notifications', 'Actividad y notificaciones')} title={t('Activity and notifications', 'Actividad y notificaciones')}><Bell size={17} />{active.length > 0 && <span>{active.length}</span>}</Button>
    {open && <Dialog open onClose={() => setOpen(false)} title={t('Activity and notifications', 'Actividad y notificaciones')} description={t('Follow running chats. Push alerts contain no chat content.', 'Sigue los chats en ejecución. Las alertas push no incluyen contenido del chat.')}>
      <h3>{t('Running chats', 'Chats en ejecución')}</h3>
      {!connected && <p role="status">{t('Disconnected: these statuses may be out of date.', 'Sin conexión: estos estados pueden estar desactualizados.')}</p>}
      {!active.length && <p>{t('No running chats.', 'No hay chats en ejecución.')}</p>}
      <div style={{ display: 'grid', gap: 8, maxHeight: '35vh', overflowY: 'auto' }}>
        {active.map((item) => <Button key={item.id} variant="secondary" onClick={() => { select(item); setOpen(false) }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
          <span>{state.agents[item.id]?.status === 'waiting' ? t('Awaiting approval', 'Espera aprobación') : t('Running', 'En ejecución')}</span>
        </Button>)}
      </div>
      <h3>{t('Alerts on this device', 'Alertas en este dispositivo')}</h3>
      <p>{t('Get notified on completion, errors and approval requests, even with Alfred closed. Delivery depends on your system and connection.', 'Recibe avisos de finalización, errores y solicitudes de aprobación, incluso con Alfred cerrado. La entrega depende del sistema y de la conexión.')}</p>
      {!available && <p>{t('Requires HTTPS and a browser with Web Push. On iPhone/iPad (16.4+), add Alfred to your Home Screen and open it there.', 'Requiere HTTPS y un navegador con Web Push. En iPhone/iPad (16.4+), añade Alfred a la pantalla de inicio y ábrelo desde allí.')}</p>}
      <Button disabled={!available || !checked || busy} onClick={() => void toggle()}>{busy ? t('Saving…', 'Guardando…') : enabled ? t('Disable alerts', 'Desactivar alertas') : t('Enable alerts', 'Activar alertas')}</Button>
      {error && <p role="alert">{error}</p>}
    </Dialog>}
  </>
}
