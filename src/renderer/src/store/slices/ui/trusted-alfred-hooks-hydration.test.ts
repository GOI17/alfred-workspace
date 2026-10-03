import { expect, it } from 'vitest'
import {
  hydrateTrustedAlfredHooks,
  sanitizeTrustedAlfredHooks
} from './ui-slice-hydration-sanitizers'

it('retains valid approvals without trusting malformed persisted hook records', () => {
  const valid = { contentHash: 'approved-content', approvedAt: 123 }
  expect(
    sanitizeTrustedAlfredHooks({
      repo: {
        all: { approvedAt: 100 },
        setup: valid,
        archive: { contentHash: 'hash', approvedAt: '123' },
        issueCommand: { approvedAt: 123 },
        vmRecipe: valid
      },
      malformed: null,
      constructor: { all: { approvedAt: 100 } }
    })
  ).toEqual({ repo: { all: { approvedAt: 100 }, setup: valid, vmRecipe: valid } })
})

it('keeps approvals before repos load and filters them once the repo catalog is available', () => {
  const trust = { local: { all: { approvedAt: 1 } }, remote: { all: { approvedAt: 2 } } }
  expect(hydrateTrustedAlfredHooks(trust, new Set())).toEqual(trust)
  expect(hydrateTrustedAlfredHooks(trust, new Set(['remote']))).toEqual({ remote: trust.remote })
})
