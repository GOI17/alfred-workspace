type Props = {
  code: string
  valid: boolean
  busy: boolean
  onCode: (code: string) => void
  onPair: () => void
}

export function BrowserPairingForm({ code, valid, busy, onCode, onPair }: Props) {
  if (busy) {
    return null
  }
  return (
    <>
      <label htmlFor="pair-code">Desktop pairing code</label>
      <textarea
        id="pair-code"
        value={code}
        disabled={busy}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onCode(event.target.value)}
        placeholder="Scan the desktop QR or paste its pairing code"
      />
      <button className="primary" disabled={busy || !valid} onClick={onPair}>
        Connect
      </button>
    </>
  )
}
