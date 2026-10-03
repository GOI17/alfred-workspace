// The RPC implementation's Expo RNG port, backed by the browser's secure random source.
export function getRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}
