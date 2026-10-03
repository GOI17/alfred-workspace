import { describe, expect, it, vi } from 'vitest'

/**
 * The precondition is only worth anything if it runs first. A loader failure is not
 * catchable, so a preflight that lands after `main()` has already reached
 * `await import('../ipc/pty')` prevents nothing.
 */
const order: string[] = []

vi.mock('./alfredd-native-preflight', () => ({
  runAlfreddNativePreflight: () => {
    order.push('preflight')
    return true
  }
}))

vi.mock('./alfredd-entry', () => ({
  main: async () => {
    order.push('main')
  }
}))

describe('alfredd entry', () => {
  it('runs the native preflight before starting the runtime', async () => {
    await import('./main')
    await vi.waitFor(() => expect(order).toContain('main'))

    expect(order).toEqual(['preflight', 'main'])
  })
})
