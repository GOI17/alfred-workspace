import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    expect: { poll: { timeout: 5000 } },
    env: { ORCA_BACKGROUND_LAUNCH: '1' },
  },
})
