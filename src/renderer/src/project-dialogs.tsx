import { CopilotSettings } from './copilot-settings'
import { useState } from 'react'
import type { Project, ProviderId, ApiProviderId, PublicState } from '../../shared/contracts'
import { apiProviderId } from '../../shared/contracts'
import { api, errorMessage } from './api'
import { Button } from './components/ui/button'
import { Input, Select } from './components/ui/input'
import { Dialog } from './components/ui/dialog'
import { ChatgptSettings } from './chatgpt-settings'
import { SettingsScreen } from './settings-screen'
import { useUI } from './ui-preferences'

export function WorktreeDialog({ project, onClose, onAdded }: {
  project: Project; onClose: () => void; onAdded: (path: string) => void
}) {
  const { t } = useUI()
  const [branch, setBranch] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  return <Dialog open onClose={onClose} title={t('New worktree', 'Nuevo worktree')}
    description={t('An independent branch and folder for parallel work, starting from the current project commit.', 'Una rama y carpeta independientes para trabajar en paralelo, desde el commit actual del proyecto.')}>
    <form onSubmit={async (event) => {
      event.preventDefault(); setBusy(true)
      try {
        const result = await api<{ path: string }>(`/projects/${project.id}/worktrees`, { branch })
        onAdded(result.path); onClose()
      } catch (error) { setError(errorMessage(error)) }
      finally { setBusy(false) }
    }}>
      <label>{t('New branch name', 'Nombre de la nueva rama')}<Input required value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="feature/my-idea" autoComplete="off" /></label>
      {error && <p role="alert" className="error-text">{error}</p>}
      <div className="dialog-actions">
        <Button variant="ghost" onClick={onClose}>{t('Cancel', 'Cancelar')}</Button>
        <Button type="submit" disabled={busy}>{busy ? t('Creating…', 'Creando…') : t('Create worktree', 'Crear worktree')}</Button>
      </div>
    </form>
  </Dialog>
}
export const providerNames: Record<ProviderId, string> = {
  copilot: 'GitHub Copilot', opencode: 'OpenCode Zen', openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', chatgpt: 'ChatGPT',
}
const providerLinks: Record<ApiProviderId, string> = {
  copilot: 'https://github.com/settings/copilot',
  opencode: 'https://opencode.ai/auth',
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  google: 'https://aistudio.google.com/apikey',
}
// Retain the existing entry point while rendering a dedicated screen, not a dialog.
export function SettingsDialog({ state, onClose }: { state: PublicState; onClose: () => void }) {
  const { t } = useUI()
  const [provider, setProvider] = useState<ApiProviderId>('openai'), [key, setKey] = useState(''),
    [model, setModel] = useState(state.providers.find((item) => item.id === 'openai')?.model || ''),
    [error, setError] = useState(''), [saved, setSaved] = useState(false), [busy, setBusy] = useState(false)
  return <SettingsScreen state={state} onClose={onClose}>
    <ChatgptSettings state={state} />
    <CopilotSettings state={state} />
    <div className="section-label">{t('CONNECT AN API', 'CONECTAR UNA API')}</div>
    <div className="provider-summary">
      {state.providers.map((item) => <span key={item.id} className="badge"><span className="status-dot" data-status="idle" />{providerNames[item.id]} · {item.model}</span>)}
      {!state.providers.length && <span className="muted">{t('No providers connected yet.', 'Todavía no hay proveedores conectados.')}</span>}
    </div>
    <form onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError(''); setSaved(false)
      try { await api(`/providers/${provider}`, { apiKey: key, model }, 'PUT'); setKey(''); setSaved(true) }
      catch (error) { setError(errorMessage(error)) }
      finally { setBusy(false) }
    }}>
      <label>{t('Provider', 'Proveedor')}<Select value={provider} onChange={(event) => {
        const next = apiProviderId.parse(event.target.value)
        setProvider(next); setModel(state.providers.find((item) => item.id === next)?.model || ''); setKey(''); setSaved(false)
      }}>
        {Object.entries(providerNames).filter(([id]) => id !== 'chatgpt' && id !== 'copilot').map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </Select></label>
      <label>{t('Model ID', 'ID del modelo')}<Input required value={model} onChange={(event) => setModel(event.target.value)} placeholder={t('Model available in your account', 'Modelo disponible en tu cuenta')} /></label>
      <label>{t('API key', 'Clave API')}<Input required type="password" value={key} onChange={(event) => setKey(event.target.value)} autoComplete="off" placeholder={t('Paste your API key', 'Pega tu clave API')} /></label>
      <a className="text-link" href={providerLinks[provider]} target="_blank" rel="noreferrer">{t('Get an API key from', 'Obtener una clave API de')} {providerNames[provider]} ↗</a>
      <p className="field-note">{t('API key usage is billed to your provider account, separately from your ChatGPT.', 'El uso de la clave API se factura en tu cuenta del proveedor, por separado de ChatGPT.')}</p>
      {error && <p role="alert" className="error-text">{error}</p>}
      {saved && <p role="status">{t('Connection saved. It will be verified when you send your first message.', 'Conexión guardada. Se verificará al enviar tu primer mensaje.')}</p>}
      <div className="dialog-actions">
        {state.providers.some((item) => item.id === provider) && <Button variant="danger" onClick={() => {
          void api(`/providers/${provider}`, undefined, 'DELETE').catch((error) => setError(errorMessage(error)))
        }}>{t('Disconnect', 'Desconectar')}</Button>}
        <Button type="submit" disabled={busy}>{busy ? t('Saving…', 'Guardando…') : t('Save connection', 'Guardar conexión')}</Button>
      </div>
    </form>
  </SettingsScreen>
}
