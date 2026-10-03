// The native client identity is a pairing credential; pages receive only a session-scoped alias.
export function bindMobileWebRequestClient(
  params: unknown,
  clientId: string | null | undefined
): unknown {
  if (!clientId || typeof params !== 'object' || params === null) {
    return params
  }
  const client = 'client' in params ? bindClient(params.client, clientId) : undefined
  const mobileClient =
    'mobileClient' in params ? bindClient(params.mobileClient, clientId) : undefined
  if (client === undefined && mobileClient === undefined) {
    return params
  }
  return { ...params, ...(client ? { client } : {}), ...(mobileClient ? { mobileClient } : {}) }
}

function bindClient(client: unknown, clientId: string): object | undefined {
  if (
    typeof client !== 'object' ||
    client === null ||
    !('type' in client) ||
    client.type !== 'mobile'
  ) {
    return undefined
  }
  return { ...client, id: clientId }
}
