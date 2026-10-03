// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import type { ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type MockAuthStatus = {
  configured: boolean
  state: string
  cloud?: { displayName: string; email: string }
} | null

const mocks = vi.hoisted(() => {
  const state: { alfredProfileAuthStatus: MockAuthStatus } = {
    alfredProfileAuthStatus: {
      configured: true,
      state: 'connected',
      cloud: { displayName: 'Ada Lovelace', email: 'ada@example.com' }
    }
  }
  return {
    connect: vi.fn(),
    fetchAuthStatus: vi.fn(),
    signOut: vi.fn(),
    state
  }
})

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      ...mocks.state,
      connectCurrentAlfredProfile: mocks.connect,
      fetchAlfredProfileAuthStatus: mocks.fetchAuthStatus,
      signOutCurrentAlfredProfile: mocks.signOut
    })
}))

vi.mock('../alfred-profiles/AlfredProfileSignOutConfirmDialog', () => ({
  AlfredProfileSignOutConfirmDialog: ({
    open,
    onConfirm
  }: {
    open: boolean
    onConfirm: () => void
    children?: ReactNode
  }) => (open ? <button onClick={onConfirm}>Confirm sign out</button> : null)
}))

import { AlfredAccountSettingsPane } from './AlfredAccountSettingsPane'

describe('AlfredAccountSettingsPane', () => {
  beforeEach(() => {
    mocks.connect.mockReset()
    mocks.fetchAuthStatus.mockReset()
    mocks.signOut.mockReset()
    mocks.signOut.mockResolvedValue({ status: 'signed-out' })
    mocks.state.alfredProfileAuthStatus = {
      configured: true,
      state: 'connected',
      cloud: { displayName: 'Ada Lovelace', email: 'ada@example.com' }
    }
  })

  afterEach(cleanup)

  it('shows the connected identity and confirms sign out', async () => {
    const user = userEvent.setup()
    render(<AlfredAccountSettingsPane />)

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByText('Artifact sharing')).toBeInTheDocument()
    expect(screen.getByText('Alfred Relay')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await user.click(screen.getByRole('button', { name: 'Confirm sign out' }))
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })

  it('offers sign in for a local profile', async () => {
    const user = userEvent.setup()
    mocks.state.alfredProfileAuthStatus = { configured: true, state: 'local' }
    mocks.connect.mockReturnValue(new Promise(() => {}))
    render(<AlfredAccountSettingsPane />)

    expect(
      screen.getByText(
        'Sign in to extend Alfred with cloud features, including Artifacts and Alfred Relay.'
      )
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign in to Alfred' }))
    expect(mocks.connect).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Sign in to Alfred' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Sign in to Alfred' }))
    expect(mocks.connect).toHaveBeenCalledTimes(2)
  })

  it('loads account status when it is not hydrated yet', () => {
    mocks.state.alfredProfileAuthStatus = null
    render(<AlfredAccountSettingsPane />)

    expect(mocks.fetchAuthStatus).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Sign in to Alfred' })).toBeDisabled()
  })
})
